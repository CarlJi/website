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

但就像我在之前文章中提到的，golangci-lint 的 linter 和配置项非常多，且很多配置项的默认值，并不是最佳实践。所以，在实际使用中，大家往往需要根据自身项目的情况，进行针对性的配置。

但当你想启用更多的 linter 时，你可能随之会发现 "golangci-lint 官方" 好像并没有给出一份最佳实践的配置。

咦，这是为什么呢？

大概率有两方面原因:

- **工具定位**，golangci-lint 是 linter 聚合器。所以其必然不能有太过明确的倾向，不然其他的 linter 作者哪还有动力往 golangci-lint 里添加新的 linter，对吧?

- 静态分析问题，难就难在权衡 **False Positive(误报) 和 False Negative(漏报)** 的问题。所谓鱼和熊掌不可兼得，所有的 linter 的实现者，都需要做抉择。如果一个 linter 过于严格，则可能会导致误报变多，影响开发体验。反之，如果一个 linter 过于宽松，则可能会检测不出问题，那这个 linter 也就失去了意义。

另外就是，不同的项目，其关注点可能也会不同，所以比较难有通用的最佳实践。

不过呢, qiniu/reviewbot 这边，经过调研和实践后，还是总结出了一份配置，当然仅供参考。

## 这份配置的严肃性

这份配置是怎么来的呢？

- 首先参考了一个关注比较多的配置实践。

> https://gist.github.com/maratori/47a4d00457a92aa426dbd48a18776322

- 然后，我将 golangci-lint 集成的所有 linter，按其 star 数排序，重点选取了 100+ star 的 linter，并参考了其配置。

- 然后又参考了几个著名公司/项目的配置。

> https://github.com/golangci/golangci-lint/blob/master/.golangci.yml

> https://github.com/golangci/golangci-lint/blob/master/.golangci.yml

- 最后，就是基于七牛内部实践和倾向，形成的一份配置。
  - 比如安全相关的 lint，我们倾向于严格一些。

如此，这份配置就形成了。

当然，这份配置并不适合所有项目，但它可以作为你项目的初始配置，然后根据项目的实际情况，进行必要调整。

实际上配置项的选择上，难就难在挺难权衡 False Positive(误报) 和 False Negative(漏报) 的问题。

因为很多 linter 的实现，并没有那么精准，误报是很常见的。

所以这就会导致，筛选的严格意味着可用的 linter 会变少，就有可能漏掉一些问题。

而筛选的宽松，启用太多的 linter，则会导致误报变多，影响开发体验。

所以通常大家需要做的是在 False Positive(误报) 和 False Negative(漏报) 之间找到一个平衡点，让其适合你的项目。

当然，并不是说这是一劳永逸的，随着项目的发展，你可能会发现一些新的问题，或者一些老的问题，可能需要调整。

同样，社区的 linter 也在不断发展，新的 linter 也在不断加入，所以这份配置也需要不断的更新。

感谢阅读。
