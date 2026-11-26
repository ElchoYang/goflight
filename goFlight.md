# goFlight 项目分析 + 原生功能练手路线

## 一、技术栈概览

| 项           | 现状                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| RN 版本      | 0.88.1，**新架构已开启**（`newArchEnabled=true`，Fabric/TurboModules 可用）                              |
| 引擎         | Hermes                                                                                                   |
| 原生接入方式 | 标准 RN CLI 工程，但通过 `install-expo-modules` 接入了 **Expo Modules（expo 58.0.26）**                  |
| 语言         | TypeScript / Kotlin / Swift                                                                              |
| 导航         | React Navigation 7：native-stack + bottom-tabs                                                           |
| 其他         | Reanimated 4、Gesture Handler、Safe Area、Vector Icons、AsyncStorage、datetimepicker、expo-notifications |
| 包名         | **混乱**：namespace `com.goFlight`、applicationId `com.king.demo`、源码目录包名 `com.rn_cli_demo`        |

---

## 二、当前已实现的功能

### 1. 导航骨架

[src/navigation/AppNavigator.tsx](src/navigation/AppNavigator.tsx) 已搭好完整结构：

- 根 Stack：`MainTabs` / `SearchFlight` / `FlightResults` / `FlightDetail`
- 底部 4 个 Tab：Home、Flights、My Trips、Profile
- 路由参数类型 `RootStackParamList`、`BottomTabParamList` 已定义
- [navigationRef.ts](src/navigation/navigationRef.ts) 支持在 React 外（通知回调）导航

### 2. 首页（唯一真正做完的页面）

[HomeScreen.tsx](src/screens/HomeScreen.tsx)：

- 出发/到达城市展示、交换按钮
- 乘客数 +、日期选择（`@react-native-community/datetimepicker`，用的是 v9 新 API `onValueChange`）
- "Search Flights" 跳转 `SearchFlight`
- 静态的热门目的地列表
- 整个页面 UI 已成型，但**数据全是本地写死的**

### 3. 通知体系

[src/services/notificationService.ts](src/services/notificationService.ts) + [useNotifications.ts](src/hooks/useNotifications.ts)：

- 前台通知展示策略（banner / list / sound / badge）
- Android 通知渠道创建（`IMPORTANCE.MAX`）
- 权限申请 + 获取 Expo Push Token，并写入 AsyncStorage
- 本地通知：`scheduleNotificationAsync({ trigger: null })` 立即发送
- 远程推送：向 `exp.host` 发请求（需要有效 token）
- 点击通知回调里根据 `data.screen` 做**深链跳转**
- [ProfileScreen.tsx](src/screens/ProfileScreen.tsx) 提供两个按钮做测试入口

### 4. 其他

- [TabIcon.tsx](src/components/TabIcon.tsx)：Ionicons + 类型约束
- [NotificationButton.tsx](src/components/NotificationButton.tsx)：通用按钮
- [App.tsx](App.tsx)：SafeAreaProvider + GestureHandlerRootView + 通知监听
- 单测仅有一个"能渲染"的冒烟测试

---

## 三、目前是空壳的页面（业务主流程断在这里）

| 页面                                                                            | 状态                               |
| ------------------------------------------------------------------------------- | ---------------------------------- |
| [SearchFlightScreen.tsx](src/screens/SearchFlightScreen.tsx)                    | 只有一行文字，首页按钮点进来是空白 |
| [FlightResultsScreen.tsx](src/screens/Flights/FlightResultsScreen.tsx)          | 占位                               |
| [FlightDetailScreen.tsx](src/screens/Flights/FlightDetailScreen.tsx)            | 占位                               |
| [FlightListScreen.tsx](src/screens/Flights/FlightListScreen.tsx)（Flights Tab） | 占位                               |
| [MyTripsScreen.tsx](src/screens/MyTripsScreen.tsx)                              | 占位                               |

也就是说：**搜索航班 → 结果列表 → 详情 → 加入行程** 这条核心链路尚未实现；通知是唯一做完整的"高级功能"。

---

## 四、动手练原生之前，建议先修 5 个问题

### ① 组件名不一致（当前会直接红屏，优先级最高）

- [app.json](app.json) 已改成 `"name": "goFlight"`（未提交），`index.js` 用它注册组件；
- 但 [MainActivity.kt:16](android/app/src/main/java/com/rn_cli_demo/MainActivity.kt#L16) 仍返回 `"RN_Cli_Demo"`；
- iOS [SceneDelegate.swift:32](ios/RN_Cli_Demo/SceneDelegate.swift#L32) 用的也是 `"RN_Cli_Demo"`。

→ JS 注册的是 `goFlight`，原生要的是 `RN_Cli_Demo`，跑起来会提示 "Application RN_Cli_Demo has not been registered"。**二选一统一**：要么把 app.json 的 name 改回去，要么把两端 `getMainComponentName()` / `startReactNative(withModuleName:)` 改成 `goFlight`。

### ② 包名三处不一致

[android/app/build.gradle:86-88](android/app/build.gradle#L86-L88)：`namespace com.goFlight`、`applicationId com.king.demo`；源码在 `java/com/rn_cli_demo/` 但 package 是 `com.goFlight`；`google-services.json` 里是 `com.king.demo`。建议全部收敛为一个（例如 `com.goflight.app`），否则以后接 SDK、上架、签名都会踩坑。

### ③ `google-services.json` 已被加入工作区但未忽略

[.gitignore](.gitignore) 里没有它。这个文件含 API Key，**不要提交**，加上 `android/app/google-services.json`。另外目前项目里并没有用 Firebase，`com.google.gms.google-services` 插件可以考虑移除。

### ④ 通知点击跳转对嵌套 Tab 无效

[ProfileScreen.tsx:15](src/screens/ProfileScreen.tsx#L15) 传 `{ screen: 'MyTripsTab' }`，而 `navigationRef` 挂在根 Stack 上；根 Stack 没有 `MyTripsTab` 这个路由，action 会 unhandled。正确写法：

```ts
{ screen: 'MainTabs', params: { screen: 'MyTripsTab' } }
```

### ⑤ 通知初始化没有错误处理

`registerForPushNotificationsAsync()` 未被 await，且 `getExpoPushTokenAsync` 在模拟器/无 Google 服务/网络异常时会 reject，造成未捕获 Promise。建议 `try/catch`，把"申请权限"从 App 启动时改到用户点击时（体验更好，Android 13+ 也更合规）。

> 补充：iOS 的 [SceneDelegate.swift](ios/RN_Cli_Demo/SceneDelegate.swift) 直接 `new RCTReactNativeFactory`，绕过了 `ExpoReactNativeFactory`，iOS 上 Expo 模块（含 expo-notifications）很可能没有正确注册。你在 Windows 上验证不了，建议之后在 Mac 上确认，必要时改为继承 `ExpoReactNativeFactoryDelegate`。

---

## 五、原生练手路线（由浅入深，全部贴合这个"机票 App"）

### 先选路线：Expo Module 还是裸 TurboModule？

- **Expo Module API**：你已经装了 expo-modules-core，写 `expo-module.config.json` + Kotlin/Swift 类即可，跨平台脚手架最省事，适合先跑通"JS ↔ 原生"。
- **裸 TurboModule / Fabric**：写 Codegen spec（`NativeXxx.ts`）+ `codegenConfig`，能真正理解新架构。**推荐两条都走一遍**：先用 Expo Module 快速出效果，再用 TurboModule 理解 codegen。

---

### 阶段 0：先摸清现有原生链路（半天）

目标：不写新代码，先建立"改动 → 生效"的闭环。

1. 跑 `adb logcat` 看 expo-notifications 的日志，确认通知渠道创建成功；
2. 打开 `android/build/generated/autolinking/autolinking.json`，对照 `settings.gradle` 的 expo autolinking，理解哪些库是"自动链接"进来的；
3. 在 [notificationservice.ts](src/services/notificationService.ts) 里加一行原生日志，用 Metro + logcat 双向验证；
4. 验证通知点击跳转（先修好 ④）。

**学习点**：autolinking 机制、`MainApplication` 里 `PackageList` 的作用、Expo 模块与 RN 模块两套链接体系的区别。

---

### 阶段 1：写第一个 TurboModule（1~2 天）—— 设备/航班环境信息

**练手内容**：一个 `FlightDevice` 模块，暴露：

```ts
// specs/NativeFlightDevice.ts
export interface Spec extends TurboModule {
  getConstants(): {
    model: string;
    osVersion: string;
    appVersion: string;
  };
  isAirplaneMode(): Promise<boolean>; // 异步
  vibrate(ms: number): void; // 同步 void
}
```

原生侧在 [android/app/src/main/java/com/goFlight/](android/app/src/main/java/com/goFlight/) 下新建包，用 Kotlin 实现 `getConstants`、`Settings.Global.AIRPLANE_MODE_ON`、`Vibrator`。

**学习点**：

- Codegen 配置（`codegenConfig` + `generateCodegenArtifactsFromSchema`）
- `getConstants` 与异步方法的区别、线程模型
- 同步方法为什么危险、什么时候能用
- 在 `MainApplication` 手动注册 Package（对照注释里的 `add(MyReactNativePackage())`）

**验收**：首页顶部显示真实设备型号和"飞行模式：开/关"。

---

### 阶段 2：原生事件（2~3 天）—— 飞行模式 / 网络变化监听

在阶段 1 的模块上加 `addListener('onAirplaneModeChanged')` / `onConnectivityChanged`，原生用 `BroadcastReceiver` + `registerReceiver` 推送事件。

**学习点**：

- `RCTEventEmitter` / 新架构的 EventEmitter 写法
- `startObserving` / `stopObserving` 与 JS 订阅生命周期对应
- `invalidate()` 里必须反注册广播，否则内存泄漏
- JS 侧封装成 `useAirplaneMode()` Hook，并用 Reanimated 做一个"离线模式"横幅动画

**验收**：打开系统飞行模式，App 内立刻出现离线提示条。

---

### 阶段 3：Fabric 原生组件（3~5 天）—— 登机牌 / 条形码

这是最出效果的练手：写一个原生 View `BoardingPassQrView`，接收 `code`、`size`、`color` 三个 props，在原生侧生成二维码/一维码（可用 ZXing 或手写简单绘制）。

**学习点**：

- Codegen 的 `commands` / `props` 与 ViewManager
- Fabric 的 measure/layout 回调
- props 更新、事件回传（点击二维码事件）
- Android 用 `Canvas` 或自定义 View 绘制

**验收**：在 `FlightDetail` 里展示一张原生渲染的登机牌二维码；JS 侧能通过 ref 调用 `refresh(code)`。

---

### 阶段 4：系统能力（最有价值，3~5 天/个）

按对机票 App 的价值排序：

| 练手项                                       | 实现要点                                                                            | 学习点                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Android App Widget**（桌面显示下一趟航班） | Jetpack Glance 或 RemoteViews + 点击打开 `goflight://flight/{id}`                   | 跨进程数据共享、`AppWidgetProvider` 生命周期                        |
| **通知 Action 按钮**（登机 / 延误 / 改签）   | expo-notifications 的 `categoryIdentifier` + 原生自定义通知布局                     | Notification Channel、PendingIntent、后台响应                       |
| **Deep Link / App Links**                    | `goflight://flight/123` → MainActivity intent-filter → Linking 监听，处理**冷启动** | 原生 Intent → JS 的桥接、导航队列（`navigationRef.isReady()` 时序） |
| **前台服务 + 常驻通知**（航班状态追踪）      | Android `ForegroundService` + 定时轮询                                              | Service 生命周期、Android 14 前台服务类型声明                       |
| **安全存储**                                 | Android Keystore / iOS Keychain 存登录 token                                        | 加密、生物识别解锁                                                  |
| **相机/定位/相册**                           | 先用社区库（camera-kit、geolocation）练习权限流程，再尝试自己包一层                 | 运行时权限、Android 13 细分权限                                     |

其中 **Deep Link** 和 **通知 Action** 最贴合你现在的代码，建议优先。

---

### 阶段 5：iOS 侧（需 Mac）

- 用 Swift 写一个同名模块（`FlightDevice`），对比 Kotlin 实现；
- 用 **ActivityKit** 做航班倒计时的 Live Activity / 灵动岛；
- 修复 SceneDelegate 的 Expo 初始化链路。

---

### 阶段 6：性能与调试（贯穿始终）

- 用 RN DevTools 的 Profiler 对比 JS 计算 vs 原生调用的开销；
- 用 `adb shell dumpsys gfxinfo` / systrace 看 Fabric 视图的渲染；
- 练习"把重计算搬到原生"：比如解析航班时刻表、经纬度距离计算；
- 给原生模块写 Jest mock，保证 CI 可跑。

---

## 六、如果时间有限，只做这三件事

1. **修好组件名 + 包名**（否则项目跑不起来，后面的练手无从谈起）
2. **阶段 1 的 TurboModule**（完整走一遍 codegen → Kotlin → JS，理解新架构）
3. **通知 Action + Deep Link 冷启动**（把已有的通知代码从"能弹"升级到"能操作、能跳转、能冷启动"）

---

## 七、顺手可改的小问题

- [HomeScreen.tsx](src/screens/HomeScreen.tsx)：`setPassenger(() => passenger + 1)` 应改成 `setPassenger(p => p + 1)`，避免快速点击丢计数。
- 日期选择在 iOS 上 `show` 的显隐逻辑与 Android 不同，建议按平台拆分逻辑（或抽 `useDatePicker` Hook）。
- 路由类型没有用起来：`RootStackParamList` 定义了但页面里用 `ParamListBase` + `as never`，练手时可以顺便改成 `useNavigation<NativeStackNavigationProp<RootStackParamList>>()`，通知深链也能获得类型安全。
- Reanimated/Worklets 已装但完全没用到，阶段 2 的离线横幅正好用上，验证 babel 插件链路是否正常。
