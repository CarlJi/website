---
slug: golangci-lint-best-config
title: 这里有一份 golangci-lint 的最佳配置实践
authors: CarlJi
tags: [Engineering Practices, golangci-lint, 静态检查]
---

---

TD;DR: 配置在这里: https://github.com/qiniu/reviewbot/blob/main/.golangci.yml

## 为什么会有这份配置呢？

提到 go 领域的静态检查，除了 go 官方提供的 `go vet` 之外，大家一般都会选择使用 golangci-lint，因为这个工具集合了当前 go 领域的几乎所有主流的 lint 工具。且使用也相对简单。不光在命令行场景下可以直接使用，在各种 CI 场景中，也都有方便的支持。

但就像我在之前文章中提到的，golangci-lint 的配置项非常多，且很多配置项的默认值，并不是最佳实践。所以，在实际使用中，大家往往需要根据自身项目的情况，进行针对性的配置。

但当你想启用更多的 linter 时，你可能随之会发现 "golangci-lint 官方" 好像并没有给出一份最佳实践的配置。

咦，这是为什么呢？

> 估计还是定位原因，不能有太过明确的倾向，不然其他的 linter 作者哪还有动力往 golangci-lint 里添加新的 linter，对吧?

当然，不同的项目，其关注点也会不同，比较难有通用的最佳实践。

不过呢, qiniu/reviewbot 这边，经过调研和实践后，还是总结出了一份配置，当然仅供参考。

## 这份配置的严肃性

这份配置是怎么来的呢？

- 首先参考了一个关注比较多的配置。

> https://gist.github.com/maratori/47a4d00457a92aa426dbd48a18776322

- 然后，我将 golangci-lint 集成的所有 linter，按其 star 数排序，重点选取了 100+ star 的 linter，并参考了其配置。

- 然后又参考了几个著名公司/项目的配置。

> https://github.com/golangci/golangci-lint/blob/master/.golangci.yml

- 最后，就是基于七牛内部实践，形成的一份配置。

如此，这份配置就形成了。

当然，这份配置并不适合所有项目，但它可以作为你项目的初始配置，然后根据项目的实际情况，进行必要调整。

感谢阅读。
