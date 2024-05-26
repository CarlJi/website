---
slug: kubernetes-terminating-state
title: 聊聊 Kubernetes Pod or Namespace 卡在 Terminating 状态的场景
authors: CarlJi
tags: [kubernetes]
---

这个话题，想必玩过 kubernetes 的同学当不陌生，我会分 Pod 和 Namespace 分别来谈。

## 开门见山，为什么 Pod 会卡在 Terminating 状态？

一句话，本质是 API Server 虽然标记了对象的删除，但是作为实际清理的控制器 kubelet， 并不能关停 Pod 或相关资源, 因而没能通知 API Server 做实际对象的清理。

原因何在？要解开这个原因，我们先来看 Pod Terminating 的基本流程:

1. 客户端(比如 kubectl)提交删除请求到 API Server
   - 可选传递 --grace-period 参数
2. API Server 接受到请求之后，做 Graceful Deletion 检查
   - 若需要 graceful 删除时，则更新对象的 metadata.deletionGracePeriodSeconds 和 metadata.deletionTimestamp 字段。这时候 describe 查看对象的话，会发现其已经变成 Terminating 状态了
3. Pod 所在的节点，kubelet 检测到 Pod 处于 Terminating 状态时，就会开启 Pod 的真正删除流程
   - 如果 Pod 中的容器有定义 preStop hook 事件，那 kubelet 会先执行这些容器的 hook 事件
   - 之后，kubelet 就会 Trigger 容器运行时发起`TERM`signal 给该 Pod 中的每个容器
4. 在 Kubelet 开启 Graceful Shutdown 的同时，Control Plane 也会从目标 Service 的 Endpoints 中摘除要关闭的 Pod。ReplicaSet 和其他的 workload 服务也会认定这个 Pod 不是个有效副本了。同时，Kube-proxy 也会摘除这个 Pod 的 Endpoint，这样即使 Pod 关闭很慢，也不会有流量再打到它上面。
5. 如果容器正常关闭那很好，但如果在 grace period 时间内，容器仍然运行，kubelet 会开始强制 shutdown。容器运行时会发送`SIGKILL`信号给 Pod 中所有运行的进程进行强制关闭
6. 注意在开启 Pod 删除的同时，kubelet 的其它控制器也会处理 Pod 相关的其他资源的清理动作，比如 Volume。**而待一切都清理干净之后**，Kubelet 才通过把 Pod 的 grace period 时间设为 0 来通知 API Server 强制删除 Pod 对象。

> 参考链接: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination

只有执行完第六步，Pod 的 API 对象才会被真正删除。那怎样才认为是**"一切都清理干净了"**呢？我们来看源码:

```go
// PodResourcesAreReclaimed returns true if all required node-level resources that a pod was consuming have
// been reclaimed by the kubelet.  Reclaiming resources is a prerequisite to deleting a pod from theAPI Server.
func (kl *Kubelet) PodResourcesAreReclaimed(pod *v1.Pod, status v1.PodStatus) bool {
	if kl.podWorkers.CouldHaveRunningContainers(pod.UID) {
		// We shouldn't delete pods that still have running containers
		klog.V(3).InfoS("Pod is terminated, but some containers are still running", "pod", klog.KObj(pod))
		return false
	}
	if count := countRunningContainerStatus(status); count > 0 {
		// We shouldn't delete pods until the reported pod status contains no more running containers (the previous
		// check ensures no more status can be generated, this check verifies we have seen enough of the status)
		klog.V(3).InfoS("Pod is terminated, but some container status has not yet been reported", "pod", klog.KObj(pod), "running", count)
		return false
	}
	if kl.podVolumesExist(pod.UID) && !kl.keepTerminatedPodVolumes {
		// We shouldn't delete pods whose volumes have not been cleaned up if we are not keeping terminated pod volumes
		klog.V(3).InfoS("Pod is terminated, but some volumes have not been cleaned up", "pod", klog.KObj(pod))
		return false
	}
	if kl.kubeletConfiguration.CgroupsPerQOS {
		pcm := kl.containerManager.NewPodContainerManager()
		if pcm.Exists(pod) {
			klog.V(3).InfoS("Pod is terminated, but pod cgroup sandbox has not been cleaned up", "pod", klog.KObj(pod))
			return false
		}
	}

	// Note: we leave pod containers to be reclaimed in the background since dockershim requires the
	// container for retrieving logs and we want to make sure logs are available until the pod is
	// physically deleted.

	klog.V(3).InfoS("Pod is terminated and all resources are reclaimed", "pod", klog.KObj(pod))
	return true
}
```

> 源码位置: https://github.com/kubernetes/kubernetes/blob/1f2813368eb0eb17140caa354ccbb0e72dcd6a69/pkg/kubelet/kubelet_pods.go#L923

是不是很清晰？总结下来就三个原因：

1. Pod 里没有 Running 的容器
2. Pod 的 Volume 也清理干净了
3. Pod 的 cgroup 设置也没了

如是而已。

自然，其反向对应的就是各个异常场景了。我们来细看：

- 容器停不掉 - 这种属于 CRI 范畴，常见的一般使用 docker 作为容器运行时。笔者就曾经遇到过个场景，用`docker ps` 能看到目标容器是`Up`状态，但是执行`docker stop or rm` 却没有任何反应，而执行`docker exec`，会报`no such container`的错误。也就是说此时这个容器的状态是错乱的，docker 自己都没法清理这个容器，可想而知 kubelet 更是无能无力。workaround 恢复操作也简单，此时我只是简单的重启了下 docker，目标容器就消失了，Pod 的卡住状态也很快恢复了。当然，若要深究，就需要看看 docker 侧，为何这个容器的状态错乱了。
  - 更常见的情况是出现了僵尸进程，对应容器清理不了，Pod 自然也会卡在 Terminating 状态。此时要想恢复，可能就只能重启机器了。
- Volume 清理不了 - 我们知道在 PV 的"两阶段处理流程中"，Attach&Dettach 由 Volume Controller 负责，而 Mount&Unmount 则是 kubelet 要参与负责。笔者在日常中有看到一些因为自定义 CSI 的不完善，导致 kubelet 不能 Unmount Volume，从而让 Pod 卡住的场景。所以我们在日常开发和测试自定义 CSI 时，要小心这一点。
- cgroups 没删除 - 启用 QoS 功能来管理 Pod 的服务质量时，kubelet 需要为 Pod 设置合适的 cgroup level，而这是需要在相应的位置写入合适配置文件的。自然，这个配置也需要在 Pod 删除时清理掉。笔者日常到是没有碰到过 cgroups 清理不了的场景，所以此处暂且不表。

现实中导致 Pod 卡住的细分场景可能还有很多，但不用担心，其实多数情况下通过查看 kubelet 日志都能很快定位出来的。之后顺藤摸瓜，恢复方案也大多不难。

> 当然还有一些系统级或者基础设施级异常，比如 kubelet 挂了，节点访问不了 API Server 了，甚至节点宕机等等，已经超过了 kubelet 的能力范畴，不在此讨论范围之类。

> 还有个注意点，如果你发现 kubelet 里面的日志有效信息很少，要注意看是不是 Log Level 等级过低了。从源码看，很多更具体的信息，是需要大于等于 3 级别才输出的。

## 那 Namespace 卡在 Terminating 状态的原因是啥？

显而易见，删除 Namespace 意味着要删除其下的所有资源，而如果其中 Pod 删除卡住了，那 Namespace 必然也会卡在 Terminating 状态。

除此之外，结合日常使用，笔者发现 CRD 资源发生删不掉的情况也比较高。这是为什么呢？至此，那就不得不聊聊 Finalizers 机制了。

官方有篇博客专门讲到了这个，里面有个实验挺有意思。随便给一个 configmap，加上个 finalizers 字段之后，然后使用`kubectl delete`删除它就会发现，直接是卡住的，kubernetes 自身永远也删不了它。

> 参考: https://kubernetes.io/blog/2021/05/14/using-finalizers-to-control-deletion/#understanding-finalizers

原因何在？

原来 Finalizers 在设计上就是个 pre-delete 的钩子，其目的是让相关控制器有机会做自定义的清理动作。通常控制器在清理完资源后，会将对象的 finalizers 字段清空，然后 kubernetes 才能接着删除对象。而像上面的实验，没有相关控制器能处理我们随意添加的 finalizers 字段,那对象当然会一直卡在 Terminating 状态了。

自己开发 CRD 及 Controller，因成熟度等因素，发生问题的概率自然比较大。除此之外，引入 webhook(mutatingwebhookconfigurations/validatingwebhookconfigurations)出问题的概率也比较大，日常也要比较注意。

综合来看，遇 Namespace 删除卡住的场景，笔者认为，基本可以按以下思路排查：

1. `kubectl get ns $NAMESPACE -o yaml`， 查看`conditions`字段，看看是否有相关信息
2. 如果上面不明显，那就可以具体分析空间下，还遗留哪些资源，然后做更针对性处理
   - 参考命令: `kubectl api-resources --verbs=list --namespaced -o name | xargs -n 1 kubectl get --show-kind --ignore-not-found -n $NAMESPACE
`

找准了问题原因，然后做相应处理，kubernetes 自然能够清理对应的 ns 对象。不建议直接清空 ns 的 finalizers 字段做强制删除，这会引入不可控风险。

> 参考: https://github.com/kubernetes/kubernetes/issues/60807#issuecomment-524772920

### 相关阅读

前同事也有几篇关于 kubernetes 资源删除的文章，写的非常好，推荐大家读读：

- https://zhuanlan.zhihu.com/p/164601470
- https://zhuanlan.zhihu.com/p/161072336

## 往期推荐

- [构建高效 Presubmit 卡点，落地测试左移最佳实践 ](https://www.cnblogs.com/jinsdu/p/15058469.html)
- [谈谈测试环境管理与实践 ](https://www.cnblogs.com/jinsdu/p/14736491.html)
- [我们是如何做 go 系统覆盖率收集的？](https://www.cnblogs.com/jinsdu/p/12240909.html)
- [聊聊 Go 代码覆盖率技术与最佳实践 ](https://www.cnblogs.com/jinsdu/p/13941773.html)
