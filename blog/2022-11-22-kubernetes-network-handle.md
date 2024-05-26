---
slug: kubernetes-network
title: 聊聊如何让办公网络直连Kubernetes集群PodIP/ClusterIP/Service DNS等
authors: CarlJi
tags: [kubernetes, 网络]
---

想象一下，如果您日常使用的研发测试 Kubernetes 集群，能够有以下效果:

- 在办公网络下直接访问 Pod IP
- 在办公网络下直接访问 Service Cluster IP
- 在办公网络下直接访问集群内部域名，类似 service.namespace.svc.cluster.local

会不会很方便，很优雅？

笔者近期就给内部的一个新集群做过类似的调整，特此分享一些心得。

> PS: 这里的 直接访问/直连 指的是不借助 Ingress/hostnetwork:true/NodePort 等常规方式，直接访问 k8s 内部 IP or DNS，起到 网络拉平 的效果。

### 先决条件 - 三层路由方案

办公网段跟 Kubernetes 集群大概率是不同的网段，所以要想打通最自然的想法是依赖路由。相应的，Kubernetes 跨主机网络方案，我们最好也选择三层路由方案或者 Host-GW，而非 Overlay，不然数据包在封包解包过程中可能会失去路由方向。

我们的集群选用的是 Calico，且关闭了 IPIP 模式。具体的 IPPool 配置如下：

```shell
-> calicoctl get IPPool -o yaml
apiVersion: projectcalico.org/v3
items:
- apiVersion: projectcalico.org/v3
  kind: IPPool
  metadata:
    name: default-pool
  spec:
    blockSize: 24
    cidr: 10.233.64.0/18
    # 关闭IPIP模式
    ipipMode: Never
    natOutgoing: true
    nodeSelector: all()
    vxlanMode: Never
kind: IPPoolList
```

### Calico RR（Route Reflectors）or Full-Mesh 模式？

网上的很多类似教程，上来都会引导大家先把集群改为 RR 模式，其实这不是必须的。大家可以思考下，RR 模式解决的问题是什么？是为了防止所有节点间都做 BGP 连接交换，浪费资源。但如果你的集群很小， 且已经是按 Full Mesh 模式部署了，到也没必要非得改为 RR 模式。Full Mesh 下所有的节点都是类似 RR 节点的效果，所以如果我们想选择作为 BGPPeer 交换的节点，选择任意节点就行。 比如，笔者的集群就选择了 Ingress 所在的节点，作为 BGPPeer。

```shell
~ calicoctl get BGPPeer -o yaml
apiVersion: projectcalico.org/v3
items:
- apiVersion: projectcalico.org/v3
  kind: BGPPeer
  metadata:
    name: peer-switch
  spec:
  	# 交换机配置
    asNumber: 65200
    peerIP: 10.200.20.254
    # 这个label是Ingress节点特有的
    nodeSelector: node-role.kubernetes.io/ingress == 'ingress'
kind: BGPPeerList
```

### 从集群外部访问 Pod IP vs 从集群内部访问?

这个问题很关键，如果我们想从外部直接访问到集群内部的 Pod IP，那么首先需要搞清楚集群内的节点是如何畅通访问的。

以下面的节点为例，我们来看它的路由信息：

```shell
~ ip r
# 默认路由
default via 10.200.20.21 dev bond0 onlink
# 宿主机数据包路由
10.200.20.0/24 dev bond0 proto kernel scope link src 10.200.20.105
# 黑洞，防止成环
blackhole 10.233.98.0/24 proto bird
# 目的地址是10.233.98.3的数据包,走cali9832424c93e网卡
10.233.98.3 dev cali9832424c93e scope link
# 目的地址是10.233.98.4的数据包,走cali4f5c6d27f17网卡
10.233.98.4 dev cali4f5c6d27f17 scope link
# 目的地址是10.233.98.8的数据包,走cali8f10abc672f网卡
10.233.98.8 dev cali8f10abc672f scope link
# 目的地址是10.233.110.0/24网段的数据包，从bond0网卡出到下一跳10.200.20.107上
10.233.110.0/24 via 10.200.20.107 dev bond0 proto bird
# 目的地址是10.233.112.0/24网段的数据包，从bond0网卡出到下一跳10.200.20.106上
10.233.112.0/24 via 10.200.20.106 dev bond0 proto bird
# 目的地址是10.233.115.0/24网段的数据包，从bond0网卡出到下一跳10.200.20.108上
10.233.115.0/24 via 10.200.20.108 dev bond0 proto bird
```

相信看了笔者的注释，大家应该很容易了解到以下信息：

- 这台宿主机 IP 是 10.200.20.105，集群内其他的宿主机还有 10.200.20.106, 10.200.20.107, 10.200.20.108 等
- 主机 10.200.20.105 上的 Pod IP 段是 10.233.98.0/24, 10.200.20.106 上是 10.233.112.0/24，10.200.20.107 上是 10.233.110.0/24
- 目的地址是 10.233.98.3 的数据包走 cali9832424c93e 网卡，目的地址 10.233.98.4 的数据包走 cali4f5c6d27f17 网卡等

而这些信息实际解答了，容器数据包的 **出和入** 这个关键问题:

- 比如想访问 Pod IP 为 10.233.110.7 的容器，宿主机自然知道下一跳是 10.200.20.107 上
- 比如接收到了目的地址是 10.233.98.8 的数据包，宿主机自然也知道要把这个包交给 cali8f10abc672f 网卡。而这个网卡是 veth pair 设备的一端，另一端必然在目标 Pod 里

那这些路由信息是哪里来的呢？自然是 Calico 借助 BGP 的能力实现的。我们进一步想，如果外部节点也有这些信息，是不是也就自然知道了 Pod IP 在哪里了？ 答案确实如此，其实总结基于 Calico 的网络打平方案，核心原理就是 **通过 BGP 能力，将集群路由信息广播给外部。**

而在具体的配置上，就比较简单了，只需要在两端配置好 BGP Peer 即可。

- 先是集群这一侧，前面笔者已给出:

  ```shell
  ~ calicoctl get BGPPeer -o yaml
  apiVersion: projectcalico.org/v3
  items:
  - apiVersion: projectcalico.org/v3
    kind: BGPPeer
    metadata:
      name: peer-switch
    spec:
    	# 交换机配置
      asNumber: 65200
      peerIP: 10.200.20.254
      # 这个label就是Ingress节点特有的
      nodeSelector: node-role.kubernetes.io/ingress == 'ingress'
  kind: BGPPeerList
  ```

- 再就是外部，一般是交换机，使用类似下面的命令:

  ```shell
  [SwitchC] bgp 64513       # 这是k8s集群的ASN
  [SwitchC-bgp] peer 10.200.20.107 as-number 64513
  [SwitchC-bgp] peer 10.200.20.108 as-number 64513
  ```

  > PS: 具体的交换机操作方式可以参考各品牌交换机官方文档

到这里，基本上我们已经打通了外部直接访问 Pod IP 的能力。当然，如果您的办公网络到交换机这一侧还有多个网关，您还需要在这些网关上设置合适的路由才行。

### 为什么 Service Cluster IP 还不能访问？

也许这时候您会发现，可以直连 Pod IP，但 Cluster IP 不可以，这是为什么呢？原来，默认情况 Calico 并没有广播 Service IP，您可以在交换机这一侧通过查看交换过来的 IP 段来确认这一点。

> PS: 您是否注意到，k8s 主机节点上也没有 service 的 ip 路由，但为啥在集群内部访问 service 没有问题呢？

解决方案也简单，只要打开相关的设置即可, 类似如下:

```shell

~ calicoctl get bgpconfig default -o yaml
apiVersion: projectcalico.org/v3
kind: BGPConfiguration
metadata:
  name: default
spec:
  asNumber: 64513
  listenPort: 179
  logSeverityScreen: Info
  nodeToNodeMeshEnabled: true
  # 这就是需要广播的service cluster IP 段
  serviceClusterIPs:
  - cidr: 10.233.0.0/18
```

### 打通内网 DNS，直接访问 Service 域名

直连 IP 虽然方便，但有时若想记住某服务的具体 IP 却不是那么容易。所以，我们将 K8s 内部的 DNS 域名也暴漏出来了，类似下面：

```
<service>.<namespaces>.svc.cluster.local
```

而这块的设置也相对简单，一般企业都有内网 DNS，只需要添加相应解析到 K8s 内部 DNS Server 即可。

### 总结

其实若想打造一个好用的研发测试集群，有很多的细节需要处理，笔者后续也会继续分享类似的经验，希望对大家有用。

### 参考链接

- https://projectcalico.docs.tigera.io/networking/bgp
- https://projectcalico.docs.tigera.io/networking/advertise-service-ips
