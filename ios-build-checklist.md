# iOS 构建修复清单（2026-11-28）

> 对应问题：`npm run ios` 报"8081 端口被占用"，实际排查后发现真正拦住的是环境 + 工程结构两层问题。
> 本次已完整跑通：`pod install`（109 dependencies / 108 pods）→ `xcodebuild` `** BUILD SUCCEEDED **` → `npm run ios` `success Successfully launched the app` → iOS 27.2 模拟器界面正常渲染。
> 本文件同时作为"以后重装环境 / 换 Mac / 再遇到同类报错"的操作手册，与 `android-build-checklist.md` 配套使用。

当前基线版本：React Native `0.88.1`、React `19.3.0`、Expo `~58.0.0`、Xcode `27.2 (27B52)`、CocoaPods `1.17.0`、Ruby `4.0.10`（Homebrew）、Node `v22.23.2`。

---

## 0. 结论速览

| # | 症状（报错原文关键片段） | 根因 | 处置方式 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools'` | 只装了命令行工具，`xcode-select` 没指向 Xcode.app | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` | ✅ 环境项 |
| 2 | `pod: command not found` / 无 `ios/Pods` | CocoaPods 未安装 | `brew install cocoapods` | ✅ 环境项 |
| 3 | `pod --version` → `Killed: 9`；ruby 同样 `Killed: 9` | Homebrew 的 ruby 是 adhoc 签名 + 带 `com.apple.quarantine`，被 Gatekeeper/AppleSystemPolicy 拒绝执行 | `brew reinstall ruby` → `chmod -R u+w` → `xattr -dr com.apple.quarantine` | ✅ 环境项 |
| 4 | `Unable to find a target named 'goFlight'` | `Podfile` 的 target 名与 `PBXNativeTarget` 不一致（`RN_Cli_Demo` vs `goFlight`） | 统一改名 + Podfile 对齐 | ✅ 已改 |
| 5 | `xcodebuild exited with error code '65'` + `overriding declaration requires an 'override' keyword` | `AppDelegate` 继承 `ExpoAppDelegate` 却没 `override` 系统回调 | 重写 `AppDelegate.swift` | ✅ 已改 |
| 6 | 运行时 `recreateRootView: Missing RCTReactNativeFactoryDelegate` | `SceneDelegate` 自建工厂、`AppDelegate` 没提供工厂 | 重写 `SceneDelegate.swift` 为 `ExpoAppSceneDelegate` | ✅ 已改 |
| 7 | `ambiguous implicit access level for import of 'Expo'` | Swift 6 要求同一模块的导入可见性一致 | 统一写 `internal import Expo` | ✅ 已改 |
| 8 | 页面红色横幅 `未找到应用程序的 "aps-environment" 的...` | 模拟器没有 APNs 能力，`getExpoPushTokenAsync` 抛出未捕获 Promise | try/catch 降级返回 `null` | ✅ 已改（真机推送另议） |
| 9 | `ios/Pods`、`ios/build` 出现在 `git status` | `.gitignore` 未覆盖 iOS 生成物 | 补三条忽略规则 | ✅ 已改（待提交） |

> 关于"8081 被占用"：这是个误判。`npx react-native run-ios` 发现已有 Metro 时会直接复用（打印 `info A dev server is already running for this project on port 8081.`），不会失败。真正报 `EADDRINUSE` 的是**又启了一个** `npm start`。所以 iOS 起不来的原因从来不是端口，是上面 1–7。顺带说明：`netsimd`（Android 模拟器的网络服务）也会监听 8081，`lsof -i :8081` 看到两个进程属正常，按 PID 判断谁是 Metro 即可。

---

## 1. 环境前置（换 Mac / 重装系统必做）

### E1 — 切换 Xcode 为活跃开发者目录

- [x] 已执行

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcode-select -p        # 期望：/Applications/Xcode.app/Contents/Developer
xcodebuild -version    # 期望：Xcode 27.2 / Build version 27B52
```

**为什么必须做**：`/Library/Developer/CommandLineTools` 里只有 `clang`、`swift` 等命令行工具，**没有** `xcodebuild` 的完整实现，也没有 iOS SDK 和模拟器运行时。`run-ios` 第一步就要调 `xcodebuild -list -json` 读 scheme，于是直接在这里失败，连编译都没开始——这也是它报错信息看起来"跟项目无关"的原因。

**以后怎么改**：装了多个 Xcode 版本时，用 `sudo xcode-select -s` 指定要用哪个；想临时用另一个可以直接跑 `DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer npx react-native run-ios`，不必改全局。

---

### E2 — 安装 CocoaPods

- [x] 已安装（`pod --version` → `1.17.0`）

```bash
brew install cocoapods
pod --version
```

**为什么用 brew 而不是 `gem install`**：本项目 `ios/Podfile` 里 `platform :ios, '16.4'`，Podfile 用的 ruby DSL 需要较新 ruby；macOS 自带的是系统 ruby（2.6.10），装 gem 会被 SIP 和权限拦，且容易把系统 ruby 搞坏。brew 自带一份独立 ruby（当前 4.0.10）和 `pod`，互不干扰。

**以后怎么改**：`brew upgrade cocoapods` 后务必重跑 E3——升级会重新引入带 quarantine 的新文件，症状和没装一模一样（`Killed: 9`）。

---

### E3 — 解除 Gatekeeper 对 Homebrew 二进制的拦截（本次最坑的一条）

- [x] 已处理

**症状**：`pod` 和 `ruby` 一执行就 `Killed: 9`，没有任何堆栈；`brew doctor` 显示一切正常；`codesign -dv` 也显示签名存在（`flags=0x2(adhoc)`）。

**诊断命令（按顺序看，五分钟能定位）**：

```bash
# 1. 看签名方式：adhoc 是 Homebrew 的正常状态
codesign -dv /opt/homebrew/opt/ruby/bin/ruby 2>&1 | head -4

# 2. 看是否带隔离属性（关键）
xattr -l /opt/homebrew/opt/ruby/bin/ruby

# 3. 看系统到底为什么拒绝（决定性证据）
log show --last 10m --predicate 'process == "kernel" OR process == "amfid" OR process == "syspolicyd"' | grep -i "ruby\|policy\|adhoc"
```

日志长这样，一看就明白：

```
amfid: /opt/homebrew/Cellar/ruby/4.0.10/bin/ruby not valid: ... Code=-423
      "The file is adhoc signed or signed by an unknown certificate chain"
syspolicyd: GK evaluateScanResult ... Prompt shown (6, 0), waiting for response
kernel: (AppleSystemPolicy) ASP: Security policy would not allow process: ..., /opt/homebrew/Cellar/ruby/4.0.10/bin/ruby
```

即：**adhoc 签名 + quarantine 属性的组合**，Apple 的安全策略默认拒绝执行，并弹了一个"是否打开"的对话框——命令行场景下没人点，进程就被杀了。

**修复（顺序不能反）**：

```bash
# 1. 先修安装残缺：本次 Cellar 里的 bin/ruby 二进制直接丢了（只剩 wrapper 脚本），必须重装
brew reinstall ruby

# 2. 去掉 quarantine。注意 Homebrew 文件权限是 555（所有者无写位），
#    不先 chmod 会报 Permission denied —— 这个报错极具误导性，会让人以为是沙箱问题
chmod -R u+w /opt/homebrew/Cellar/ruby
xattr -dr com.apple.quarantine /opt/homebrew/Cellar/ruby
```

**关键点：不止 ruby 一个包**。ruby 能起来后 `pod` 会继续报：

```
Error loading the 'psych' ... libyaml-0.2.dylib: library load disallowed by system policy
```

因为 dylib、bundle 同样是隔离状态。所以要把整条依赖链一起处理：

```bash
for pkg in ruby cocoapods libyaml openssl@4 ca-certificates; do
  chmod -R u+w "/opt/homebrew/Cellar/$pkg" 2>/dev/null
  xattr -dr com.apple.quarantine "/opt/homebrew/Cellar/$pkg" 2>/dev/null
done

pod --version   # 期望：1.17.0
```

**为什么会出现这个状态**：这批文件是通过某种"下载后转存"的方式落到 Cellar 的（保留了 `com.apple.provenance` 与 `com.apple.quarantine` 两个扩展属性），而不是 `brew` 自己从源码/瓶子里正常写入。正常 `brew install` 的包不会带 quarantine，所以这是个**环境个例**，不是本项目的问题，也不会出现在 CI 或别人的机器上。

**顺带排除的干扰项**：一开始怀疑是公司 EDR/MDM 拦截，用两条命令即可排除，别浪费时间：

```bash
systemextensionsctl list     # 期望：0 extension(s)
profiles status              # 期望：无 MDM/DEP 描述文件
```

**以后怎么改（记住这个因果链）**：

| 现象 | 直接原因 | 修法 |
| --- | --- | --- |
| `Killed: 9`（无输出） | Gatekeeper 拒绝执行 | 先看 `log show` 的 `AppleSystemPolicy` 行 |
| `xattr -d` 报 `Permission denied` | 文件权限 555 | 先 `chmod u+w`，再 `xattr -d` |
| `library load disallowed by system policy` | 依赖的 dylib/bundle 也带隔离 | 对**整个 Cellar 目录**递归 `chmod -R u+w` + `xattr -dr` |
| `brew reinstall` 后复发 | 重装又带回 quarantine | 重跑上面那段 for 循环 |

---

## 2. 工程改动明细（逐条勾选）

### C1 — 命名统一与 Podfile target 对齐

- [x] `ios/RN_Cli_Demo/` → `ios/goFlight/`（`git mv`，保留历史）
- [x] `ios/RN_Cli_Demo.xcodeproj` → `ios/goFlight.xcodeproj`
- [x] scheme `RN_Cli_Demo.xcscheme` → `goFlight.xcscheme`
- [x] `project.pbxproj`、`xcscheme`、`Podfile` 里 41 处 `RN_Cli_Demo` → `goFlight`
- [x] `android/app/src/main/java/com/rn_cli_demo/` → `.../com/goFlight/`
- [x] 清掉 scheme 里指向不存在 target 的 `<TestableReference>`（原本挂着 `RN_Cli_DemoTests`，工程里根本没这个 target）

`ios/Podfile` 现在是：

```ruby
# 注意：这里必须与 Xcode 工程里 PBXNativeTarget 的名字完全一致（当前均为 goFlight）。
# 以后若在 Xcode 里重命名 target，这里要同步改。
target 'goFlight' do
```

**为什么**：`pod install` 是按 target 名去 pbxproj 里找 `PBXNativeTarget` 的，名字对不上就 `Unable to find a target named 'goFlight'`，`Pods/` 一个都生成不出来——这是 iOS 侧第一道硬门槛，也在改名任务里被顺带解决。

**以后怎么改**：改名必须**三处同步**——`PBXNativeTarget.name`（Xcode 里改）、`Podfile` 的 `target`、`AppDelegate` 的 `reactNativeFactoryModuleName`（以及 `app.json` 的 `name`）。只改一处必然出错。校验命令：

```bash
grep -n "PBXNativeTarget" ios/goFlight.xcodeproj/project.pbxproj   # 看 name
plutil -lint ios/goFlight.xcodeproj/project.pbxproj               # 期望 OK
npx react-native config | grep -A2 '"ios"'                        # 能识别到 goFlight.xcodeproj
```

---

### C2 — `AppDelegate.swift` 整段重写

- [x] 已重写，当前内容：

```swift
import UIKit
import React
import ReactAppDependencyProvider
internal import Expo

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  var window: UIWindow?

  private(set) var reactNativeFactory: RCTReactNativeFactory?
  private var reactNativeDelegate: ReactNativeDelegate?

  /// 必须与 app.json 的 name / MainActivity 的 getMainComponentName() 保持一致
  var reactNativeFactoryModuleName: String {
    return "goFlight"
  }

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = ExpoReactNativeFactory(delegate: delegate)

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
```

**为什么这么改**：

1. `ExpoAppDelegate` 已经**声明**了 `application(_:didFinishLaunchingWithOptions:)`，子类想再实现就必须写 `override`——原来那份没写，编译期直接报 `overriding declaration requires an 'override' keyword`（Swift 的硬规则，不是风格问题）。
2. `ExpoReactNativeFactoryProvider` 是 Expo 58 新增的协议，要求 AppDelegate 暴露 `window`、`reactNativeFactory`、`reactNativeFactoryModuleName` 三样东西。`ExpoAppSceneDelegate` 就是靠这个协议从 AppDelegate 里把工厂取走的。
3. `RCTAppDependencyProvider` 是 RN 新架构（`newArchEnabled=true`）下 codegen 出来的依赖容器，不挂它，TurboModule 查找会失败。
4. `reactNativeDelegate` 必须**用属性持有**：`ReactNativeFactory` 内部是弱引用 delegate，局部变量出作用域就释放，随后启动会莫名其妙地拿不到 bundle URL。

**以后怎么改**：这段是 Expo 58 的标准样板，**不要按老 RN 模板（`RCTAppDelegate` + `RCTBridge`）的思路去改**。要新增能力（例如自定义 `RCTAppDelegate` 回调、注册自定义原生模块），在 `ReactNativeDelegate` 里加 override 方法，不要动 AppDelegate 的骨架。

---

### C3 — `SceneDelegate.swift` 整段重写

- [x] 已重写，当前内容：

```swift
import UIKit
import React
internal import Expo

/// iOS 27 起强制使用 scene 生命周期，必须由 ExpoAppSceneDelegate 来建 window 并启动 React Native。
/// 它会从 AppDelegate（ExpoAppDelegate + ExpoReactNativeFactoryProvider）里取出工厂，
/// 并把 URL / 通知等生命周期事件转发回 AppDelegate 的订阅者。
class SceneDelegate: ExpoAppSceneDelegate {
}
```

配套的 `Info.plist`（无需改动，确认即可）：

```xml
<key>UIApplicationSceneManifest</key>
<dict>
  <key>UIApplicationSupportsMultipleScenes</key><false/>
  <key>UISceneConfigurations</key>
  <dict>
    <key>UIWindowSceneSessionRoleApplication</key>
    <array><dict>
      <key>UISceneConfigurationName</key><string>Default Configuration</string>
      <key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
    </dict></array>
  </dict>
</dict>
```

**为什么必须这么改（本次最隐蔽的坑）**：原代码是个"半截拼装体"——`AppDelegate` 只继承 `ExpoAppDelegate` 但**没有**创建工厂；`SceneDelegate` 自己 `RCTReactNativeFactory(delegate: self)` 去启动。两套机制同时存在，而 Expo 58 的 `ExpoReactNativeFactory.recreateRootView` 里有一段：

```swift
guard let delegate = delegate else {
  fatalError("recreateRootView: Missing RCTReactNativeFactoryDelegate")
}
```

`delegate == nil` 就 fatalError。表现出来就是**编译通过、一启动就闪退**，日志里能看到 `recreateRootView: Missing RCTReactNativeFactoryDelegate`。而 `ExpoAppSceneDelegate` 的源码注释直接写明 "iOS 27 asserts at launch unless the app adopts the scene-based life cycle"——iOS 27 已经不允许退回旧的 AppDelegate-only 生命周期了。

结论：**window 的创建和 React 的启动必须交给 `ExpoAppSceneDelegate`**，工厂必须由 `AppDelegate` 提供（C2）。两个文件是一个整体，只改一个必然失败。

**以后怎么改**：`SceneDelegate` 保持空实现即可。需要处理 URL scheme（深链）、通知点击等，用 `ExpoAppSceneDelegate` 的转发机制（事件会回传给 AppDelegate 的订阅者），不要在这里另建 `RCTReactNativeFactory`。

---

### C4 — `internal import Expo`

- [x] 两个 Swift 文件都改成了 `internal import Expo`

**为什么**：同一个 target 里只要有**任何一处**把 `Expo` 以 `internal` 可见性导入（Expo 自己的文件就是这么写的），其它文件再用默认（`public`）可见性导入就会冲突：

```
error: ambiguous implicit access level for import of 'Expo'; it is imported as 'internal' elsewhere
```

Swift 6 的显式模块导入检查很严。统一写成 `internal import Expo` 即可，不需要改别的 import。

**以后怎么改**：这是 Swift 6 的新规则，遇到 `ambiguous implicit access level for import of 'X'` 就照抄该模块已有的写法（把 `import X` 改成 `internal import X`）。同一个文件里 `import UIKit` / `import React` 不受影响，因为它们没有可见性冲突。

---

### C5 — 推送 token 获取降级（`src/services/notificationService.ts`）

- [x] `getExpoPushTokenAsync` 整段包进 try/catch

```ts
  // 如果需要远程推送 token（本地通知不需要获取 token 也能发）
  // 模拟器没有 APNs，拿不到 token 会抛错（缺 aps-environment 权限），这里降级处理，避免红屏
  try {
    const res = await Notifications.getExpoPushTokenAsync({
      projectId: 'b74e5230-145c-465c-8cf2-9e05ee91e1e1',
    });

    token = res?.data ?? null;
    console.log('res:', res);
    console.log('token:', token);
    if (token) {
      await AsyncStorage.setItem('token', token);
    }
  } catch (error) {
    console.warn('[push] 获取远程推送 token 失败（模拟器或未配置 APNs 时属正常）:', error);
    token = null;
  }

  return token;
```

**为什么**：iOS 模拟器**永远**拿不到 APNs token（真机才分配），且当前工程没有任何 entitlements 文件（`aps-environment` 缺失）。原来直接 `await` 会让 Promise 带着错误逸出，RN 把它当未捕获异常弹红色横幅，看起来像"构建又坏了"，实际上只是模拟器的能力限制。

**降级后表现**：页面只剩一条黄色 `Open debugger to view warnings`（warning 级别），本地通知（`scheduleFlightNotification`）功能不受影响。

**以后怎么改**：要在**真机**验证远程推送，必须两件事都做，缺一不可：

1. Xcode → target `goFlight` → Signing & Capabilities → `+ Push Notifications`（会生成 `goFlight.entitlements` 里的 `aps-environment`），同时需要开发者账号签名（模拟器不支持 APNs，这一步只能在真机上验）；
2. Firebase/Expo 侧补 iOS 配置：当前 `google-services.json` 只有 Android 的 `com.king.demo` 客户端，iOS bundle id（`org.reactjs.native.example.goFlight`）没有对应 App 记录。

---

### C6 — `.gitignore` 补 iOS 生成物

- [x] 已补三条

```
# iOS
/ios/Pods
/ios/build
# 每台机器的 Node 路径，因机而异
/ios/.xcode.env.local
```

**为什么**：`Pods/` 是 `pod install` 的产物，108 个 pod、上万个文件，进仓库会让每次 `git status`/`pull` 慢到不可用，且不同机器 ruby/pod 版本不同会产生无意义的 diff；`ios/build/` 是编译中间产物；`.xcode.env.local` 里是本机 Node 绝对路径（由 RN 自动生成），换机器必然失效。

**故意保留跟踪的两样**：

| 文件 | 是否提交 | 原因 |
| --- | --- | --- |
| `ios/Podfile.lock` | ✅ 提交 | 锁定 108 个 pod 的具体版本，保证两机/CI 装出同一套依赖 |
| `ios/goFlight.xcworkspace` | ✅ 提交（体积很小） | 只是指向 `.xcodeproj` 的引用文件，打开工程靠它；内容不含机器路径 |

**校验命令**：

```bash
git check-ignore -v ios/Pods ios/build ios/.xcode.env.local   # 三条都应有输出
git check-ignore -v ios/Podfile.lock                          # 应无输出（未被忽略才对）
```

---

## 3. 验证流程（改完原生配置都建议走一遍）

1. **确认 Xcode 与工具有效**

```bash
xcode-select -p && xcodebuild -version && pod --version
```

预期：路径指向 `Xcode.app/Contents/Developer`、`Xcode 27.2`、`1.17.0`。任一不对先回第 1 节。

2. **装依赖**

```bash
cd ios && pod install && cd ..
```

预期结尾：`Pod installation complete! There are 109 dependencies from the Podfile and 108 total pods installed.`
（只有 `[!] The following Swift pods ... script phase` 这类警告是正常的，CocoaPods 对 RN 的老问题，不影响构建。）

3. **确认模拟器**

```bash
xcrun simctl list devices booted
```

预期至少一台 `Booted`。没有就 `xcrun simctl boot "iPhone 17"`，或 `open -a Simulator`。
指定机型启动：`npx react-native run-ios --simulator "iPhone 17"`。

4. **构建安装**

```bash
npm run ios
```

预期依次出现：

```
info Installing .../goFlight.app
info Launching "org.reactjs.native.example.goFlight"
success Successfully launched the app
```

如果失败，先别信 CLI 的刷屏日志（它给每行都加 `error ` 前缀，噪声极大），直接看真编译器输出：

```bash
xcodebuild -workspace ios/goFlight.xcworkspace -scheme goFlight \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17' build 2>&1 \
  | grep -E "error:|BUILD (SUCCEEDED|FAILED)" | head -20
```

5. **看界面 + 抓运行时致命错误**

```bash
xcrun simctl io booted screenshot --display=3 /tmp/ios.png
```

（`iPhone Duo` 这类双屏机型必须带 `--display=3`，否则截到的是副屏或黑屏；普通机型可省略。）

```bash
xcrun simctl spawn booted log stream --level debug \
  --predicate 'processImagePath CONTAINS "goFlight"' | grep -i "fatal\|exception"
```

正常应无 `fatal`/`exception`；JS 侧告警只会是黄色 warning 条。

---

## 4. 报错字典（下次直接对号入座）

| 报错片段 | 含义 | 一行修法 |
| --- | --- | --- |
| `xcodebuild ... requires Xcode, but active developer directory ... CommandLineTools` | 活跃开发者目录没指向 Xcode | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` |
| `pod: command not found` | 未装 CocoaPods | `brew install cocoapods` |
| `Killed: 9`（ruby/pod 无任何输出） | Gatekeeper 拒绝执行 adhoc + quarantine 的二进制 | `brew reinstall` → `chmod -R u+w` → `xattr -dr com.apple.quarantine`（见 E3） |
| `xattr: Permission denied` | Homebrew 文件权限 555 | 先 `chmod u+w <file>` 再删属性 |
| `library load disallowed by system policy` | 依赖的 dylib/bundle 也带隔离属性 | 对整个 Cellar 目录递归清（见 E3） |
| `Unable to find a target named 'goFlight'` | Podfile target 与 pbxproj target 名不一致 | 三处同步改名（见 C1） |
| `xcodebuild exited with error code '65'` | 泛化封装，真实原因要看上面几行 | 用第 3 节第 4 步的 `grep "error:"` 取真错误 |
| `overriding declaration requires an 'override' keyword` | 基类已声明该方法，子类没写 `override` | 补 `override`（见 C2） |
| `recreateRootView: Missing RCTReactNativeFactoryDelegate` | Expo 工厂没被 AppDelegate 提供 | 按 C2 + C3 重写两个文件 |
| `ambiguous implicit access level for import of 'Expo'` | 同一模块导入可见性不一致 | 改 `internal import Expo` |
| `未找到应用程序的 "aps-environment"` | 模拟器无 APNs / 无推送 entitlement | 代码降级（C5）；真机需加 Push 能力 |
| `EADDRINUSE :::8081` | 已有 Metro 在跑，又起了一个 | 别重复启；`lsof -i :8081` 找 PID。`run-ios` 会自动复用已有 Metro |
| `The following Swift pods cannot yet be integrated as static libraries` | CocoaPods 对 RN 的标准告警 | 忽略，不影响构建 |

---

## 5. 换/重装 Mac 的接入 checklist

- [ ] 装 Xcode（App Store 或开发者网站），启动一次同意协议，装好 iOS 模拟器运行时
- [ ] `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- [ ] `xcodebuild -version` 有输出
- [ ] `brew install cocoapods`，`pod --version` 正常（若 `Killed: 9`，走 E3）
- [ ] `npm install`（保持与另一台机器同一份 `package-lock.json`）
- [ ] `cd ios && pod install`（首次会下载 `reactnative-core-0.88.1-debug.tar.gz` 约 96MB 到 `~/Library/Caches/ReactNative`，慢是正常的）
- [ ] `npm start`（一个 Metro 同时服务 Android 与 iOS，不要开第二个）
- [ ] `npm run ios`
- [ ] 确认没有红色 error 横幅，只有黄色 warning

> 跨机器注意：本仓库还要和 Windows 机器同步。iOS 目录在 Windows 上无法构建，所以**不要把 iOS 特有的配置写进共享文件**（例如不要在 `package.json` 的 `ios` 脚本里写死 `--simulator "iPhone Duo"`，换机器就失效）。`.xcode.env.local` 已在 `.gitignore` 里，这类机器相关文件一律不提交。

---

## 6. 已知但本次未处理（留待后续）

- [ ] **真机推送**：无 `goFlight.entitlements`、无 `aps-environment`。需要开发者账号 + Xcode 加 Push Notifications capability，且只能在真机验证。
- [ ] **iOS bundle id 未统一**：当前由 `PRODUCT_NAME` 推导为 `org.reactjs.native.example.goFlight`，而 Android 是 `com.king.demo`、namespace 是 `com.goFlight`。三套标识并存，接 Firebase/推送/深链时容易配错。建议统一成 `com.king.demo`，但要同步改 Firebase 里的 iOS App 记录。
- [ ] **一个历史类型错误**：`src/hooks/useNotifications.ts:30` 的 `navigate(data.screen, data.params)` 报 `TS2345`（`content.data` 被推断为 `{}`）。与 iOS 构建无关（Metro 不做类型检查），但 `npx tsc --noEmit` 会红。修法：`navigate(data.screen as string, data.params)` 或在 `NotificationData` 上补索引签名。
- [ ] **模拟器选择**：`run-ios` 默认取当前 Booted 的机型。本次是 `iPhone Duo`（折叠屏双 display），截图需 `--display=3`，界面在副屏上看起来会有裁切感——属机型特性，不是布局 bug。日常建议 `--simulator "iPhone 17"`。
- [ ] **`Pods/` 体积**：约 96MB+ 的预编译 core 包缓存于 `~/Library/Caches/ReactNative`，磁盘紧张时可清理，下次 `pod install` 会重新下载。
