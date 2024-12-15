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

这两个检查，都是圈复杂度相关。

> 圈复杂度（Cyclomatic complexity）是由 Thomas McCabe 提出的一种度量代码复杂性的指标，用于计算程序中线性独立路径的数量。它通过统计程序控制流中的判定节点（如 if、for、while、switch、&&、|| 等）来计算。圈复杂度越高，表示代码路径越多，测试和维护的难度也就越大。

圈复杂度高的代码，往往意味着代码的可读性和可维护性差，非常容易出 bug。

为什么这么说呢？其实就跟人脑处理信息一样，一件事情弯弯曲曲十八绕，当然容易让人晕。

所以从工程实践角度，我们希望代码的圈复杂度不能太高，毕竟绝大部分代码不是一次性的，是需要人来维护的。

那该怎么做呢？

这里我首先推荐一个简单有效的方法：**Early return**。

### Early return - 逻辑展平，减少嵌套

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

这段代码的逻辑应该挺简单的，但嵌套层级有点多，如果以后再复杂一点，就容易出错。

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

记住这里的诀窍：**如果你觉得顺向思维写出的代码有点绕，且嵌套过多的话，就可以考虑使用 early return 来反向展平。**

当然，严格意义上讲，early return 只能算是一种小技巧。要想写出高质量的代码，最重要的还是理解 分层、组合、单一职责、高内聚低耦合、SOLID 原则等 这些核心设计理念 和 设计模式了。

### Functional Options 模式 - 参数解耦

来看一个场景: 方法参数很多，怎么办？

比如这种：

```go
func (s *Service) DoSomething(ctx context.Context, a, b, c, d int) error {
    // ...
}
```

有一堆参数，而且还是同类型的。如果在调用时，一不小心写错了参数位置，就很麻烦，因为编译器并不能检查出来。

当然，即使不是同类型的，参数多了可能看着也不舒服。

怎么解决？

这种情况，可以选择将参数封装成一个结构体，这样在使用时就会方便很多。封装成结构体后还有一个好处，就是以后增删参数时（结构体的属性），方法签名不需要修改。避免了以前需要改方法签名时，调用方也需要跟着到处改的麻烦。

不过，在 Go 语言中，还有一种更优雅的解决方案，那就是**Functional Options 模式**。

不管是 [Rob Pike](https://github.com/golang/go/wiki/CodeReviewComments#functional-options) 还是 [Dave Cheney](https://dave.cheney.net/2014/10/17/functional-options-for-friendly-apis) 以及 uber 的 [go guides](https://github.com/uber-go/guide/blob/master/style.md#functional-options) 中都有专门的推荐。

- https://commandcenter.blogspot.com/2014/01/self-referential-functions-and-design.html
- https://dave.cheney.net/2014/10/17/functional-options-for-friendly-apis
- https://github.com/uber-go/guide/blob/master/style.md#functional-options

这种模式，本质上就是利用了闭包的特性，将参数封装成一个匿名函数，有诸多妙用。

Reviewbot 自身的代码中，就有相关的使用场景(https://github.com/qiniu/reviewbot/blob/c354fde07c5d8e4a51ddc8d763a2fac53c3e13f6/internal/lint/providergithub.go#L263)，比如：

```go
// GithubProviderOption allows customizing the provider creation.
type GithubProviderOption func(*GithubProvider)
func NewGithubProvider(ctx context.Context, githubClient *github.Client, pullRequestEvent github.PullRequestEvent, options ...GithubProviderOption) (*GithubProvider, error) {
    // ...
    for _, option := range options {
        option(p)
    }
    // ...
    if p.PullRequestChangedFiles == nil {
        // call github api to get changed files
    }
    // ...
}
```

这里的 `options` 就是 functional options 模式，可以灵活地传入不同的参数。

当时之所以选择这种写法，一个重要的原因是方便单测书写。

为什么这么说呢？

看上述代码能知道，它需要`调用 github api 去获取 changed files`， 这种实际依赖外部的场景，在单测时就很麻烦。但是，我们用了 functional options 模式之后，就可以通过 `p.PullRequestChangedFiles` 是否为 nil 这个条件，灵活的绕过这个问题。

Functional Options 模式的优点还有很多，总结来讲(from dave.cheney):

- **Functional options let you write APIs that can grow over time.**
- **They enable the default use case to be the simplest.**
- **They provide meaningful configuration parameters.**
- **Finally they give you access to the entire power of the language to initialize complex values.**

现在大模型相关的代码，能看到很多 functional options 的影子。比如
https://github.com/tmc/langchaingo/blob/238d1c713de3ca983e8f6066af6b9080c9b0e088/llms/ollama/options.go#L25

```go
type Option func(*options)
// WithModel Set the model to use.
func WithModel(model string) Option {
	return func(opts *options) {
		opts.model = model
	}
}
// WithFormat Sets the Ollama output format (currently Ollama only supports "json").
func WithFormat(format string) Option {
    // ...
}
//	If not set, the model will stay loaded for 5 minutes by default
func WithKeepAlive(keepAlive string) Option {
    // ...
}
```

所以建议大家在日常写代码时，也多有意识的尝试下。

### 善用 Builder 模式/策略模式/工厂模式，消弭复杂 if-else

Reviewbot 目前已支持两种 provider(github 和 gitlab)，以后可能还会支持更多。

而因为不同的 Provider 其鉴权方式还可能不一样，比如:

- github 目前支持 Github APP 和 Personal Access Token 两种方式
- gitlab 目前仅支持 Personal Access Token 方式

当然，还有 OAuth2 方式，后面 reviewbot 也也会考虑支持。

那这里就有一个问题，比如在 clone 代码时，该使用哪种方式？代码该怎么写？使用 token 的话，还有个 token 过期/刷新的问题，等等。

如果使用 if-else 模式来实现，代码就会变得很复杂，可读性较差。类似这种：

```go
if provider == "github" {
    // 使用 Github APP 方式
    if githubClient.AppID != "" && githubClient.AppPrivateKey != "" {
        // 使用 Github APP 方式
        // 可能需要调用 github api 获取 token
    } else if githubClient.PersonalAccessToken != "" {
        // 使用 Personal Access Token 方式
        // 可能需要调用 github api 获取 token
    } else {
        return err
    }
} else if provider == "gitlab" {
    // 使用 Personal Access Token 方式
    if gitlabClient.PersonalAccessToken != "" {
        // 使用 Personal Access Token 方式
        // 可能需要调用 gitlab api 获取 token
    } else {
        return errors.New("gitlab personal access token is required")
    }
}
```

但现在 Reviewbot 的代码中，相关代码仅两行:

```go
func (s *Server) handleSingleRef(ctx context.Context, ref config.Refs, org, repo string, platform config.Platform, installationID int64, num int, provider lint.Provider) error {
    // ...
	gb := s.newGitConfigBuilder(ref.Org, ref.Repo, platform, installationID, provider)
	if err := gb.configureGitAuth(&opt); err != nil {
		return fmt.Errorf("failed to configure git auth: %w", err)
	}
	// ...
}
```

怎么做到的呢？

其实是使用了 builder 模式，将 git 的配置和创建过程封装成一个 builder，然后根据不同的 provider 选择不同的 builder，从而消弭了复杂的 if-else 逻辑。

当然内部细节还很多，不过核心思想都是将复杂的逻辑封装起来，在主交互逻辑中，只暴露简单的使用接口，这样代码的可读性和可维护性就会大大提高。

#### 最后

到底如何写出高质量的代码呢？这可能是很多有追求的工程师，一直在思考的问题。

在我看来，可能是没有标准答案的。不过呢，知道一些技巧，并能在实战中灵活运用，总归是好的。

你说是吧？
