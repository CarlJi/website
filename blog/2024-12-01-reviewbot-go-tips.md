---
slug: reviewbot-go-tips
title: Reviewbot 开源 | 这些写 Go 代码的小技巧，你都知道吗？
authors: CarlJi
tags: [Engineering Practices, Reviewbot, 静态检查]
---

---

> [Reviewbot](https://github.com/qiniu/reviewbot) 是七牛云开源的一个项目，旨在提供一个自托管的代码审查服务, 方便做 code review/静态检查, 以及自定义工程规范的落地。

---

自从上了 Reviewbot 之后，我发现有些 lint 错误，还是很容易出现的。比如

```
dao/files_dao.go:119:2: `if state.Valid() || !start.IsZero() || !end.IsZero()` has complex nested blocks (complexity: 6) (nestif)
```

```
cognitive complexity 33 of func (*GitlabProvider).Report is high (> 30) (gocognit)
```

这两个检查，都是圈复杂度相关的。

> 圈复杂度（Cyclomatic complexity）是一种度量代码复杂性的指标，用于衡量代码中决策分支的数量。它通过计算代码中条件语句（如 if、for、while、switch 等）的数量和嵌套层次来确定圈复杂度。

圈复杂度高的代码，往往意味着代码的可读性和可维护性差，非常容易出 bug。

为什么这么说呢？其实就跟人脑处理信息一样，一件事情弯弯曲曲十八绕，当然容易让人晕。

所以从工程实践角度，我们希望代码的圈复杂度不能太高，毕竟绝大部分代码不是一次性的，是需要人来维护的。

那该怎么做呢？

这里我首先推荐一个简单有效的方法：**Early return**。

### Early return

Early return, 也就是提前返回，是我个人认为最简单，日常很多新手同学容易忽视的方法。

举个例子：

```go
func validate(data *Data) error {
    if data != nil {
        if data.Field != "" {
            if checkField(data.Field) {
                return nil
            }
        }
    }
    return errors.New("invalid data")
}
```

这段代码的逻辑应该挺简单的，但嵌套层级有点多，如果再复杂一点，很容易出错。

这种情况就可以使用 early return 模式改写，把这个嵌套展平：

```go
func validate(data *Data) error {
    if data == nil {
        return errors.New("data is nil")
    }
    if data.Field == "" {
        return errors.New("field is empty")
    }
    if !checkField(data.Field) {
        return errors.New("field validation failed")
    }
    return nil
}
```

是不是清晰很多，看着舒服多了？

记住这里的诀窍，如果你觉得顺向思维写出的代码有点绕，且嵌套过多的话，就可以考虑使用 early return 来反向展平。

当然，严格意义上讲，early return 只能算是一种小技巧，最重要的还是理解 分层、拆分、组合 这些核心理念。

而这些设计理念，有很多耳熟能详的经典场景，比如：

- 如果一个函数里有复杂的 if-else，就可以考虑使用**状态机**或**策略模式**来替代
- 如果一个函数里有多个步骤需要按顺序处理数据，就可以考虑使用**责任链模式**来替代
- 如果一个函数里需要根据不同条件创建相关对象，就可以考虑使用**工厂模式**来替代

此类场景还有很多，网上介绍也不少，这里就不一一展开了。

### 方法参数很多，怎么办？

比如这种：

```go
func (s *Service) DoSomething(ctx context.Context, a, b, c, d int) error {
    // ...
}
```

有一堆参数，而且还是同类型的。如果在调用时，一不小心写错了参数位置，就很麻烦了，编译器并不能检查出来。

这种情况，可以选择将参数封装成一个结构体，这样在使用时就会方便很多。封装成结构体后还有一个好处，就是以后增删参数时（结构体的属性），方法签名不需要修改。避免了以前需要改方法签名时，调用方也需要跟着到处改的麻烦。

但其实在 Go 语言中，还有一种更优雅的解决方案，那就是**Functional Options 模式**。

### Functional Options 模式

实际上 Go 官方非常推荐这种模式，不管是 [Rob Pike](https://github.com/golang/go/wiki/CodeReviewComments#functional-options) 还是 [Dave Cheney](https://dave.cheney.net/2014/10/17/functional-options-for-friendly-apis) 以及 uber 的 [go guides](https://github.com/uber-go/guide/blob/master/style.md#functional-options) 中都有专门的推荐。

- https://commandcenter.blogspot.com/2014/01/self-referential-functions-and-design.html
- https://dave.cheney.net/2014/10/17/functional-options-for-friendly-apis
- https://github.com/uber-go/guide/blob/master/style.md#functional-options

这种模式，本质上就是利用了闭包的特性，将参数封装成一个匿名函数，从而避免了以前需要改方法签名时，调用方也需要跟着到处改的麻烦。

举个例子，这也是 reviewbot 中使用的一个场景：

### Builder 模式
