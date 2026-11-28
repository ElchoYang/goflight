# Android 构建修复清单（2026-11-28）

> 对应问题：`npm run android` 反复失败。
> 本次已完整跑通：`BUILD SUCCESSFUL in 5m 48s` → APK 装入 arm64 模拟器 → Metro 连通 → 界面正常渲染。
> 本文件同时作为"以后换机器 / 重装环境 / 再遇到同类报错"的操作手册。

---

## 0. 结论速览

| # | 症状（报错原文关键片段） | 根因 | 处置方式 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `SDK location not found. Define a valid SDK location with an ANDROID_HOME ... or sdk.dir` | 缺 `android/local.properties`，且 shell 没导出 `ANDROID_HOME` | 新建 `android/local.properties`，写入本机 SDK 路径 | ✅ 已改 |
| 2 | 装上后 `INSTALL_FAILED_NO_MATCHING_ABIS` 或 `couldn't find DSO to load: libhermes.so` | `gradle.properties` 写死 `reactNativeArchitectures=x86_64`，而 Mac 模拟器是 arm64-v8a | 删掉写死的 ABI，改用 `--active-arch-only` 按设备自动取 | ✅ 已改 |
| 3 | `Could not GET ... repo.maven.apache.org ... Remote host terminated the handshake` | 国内直连 Maven Central，并发握手被对端断开 | 在仓库列表最前面加阿里云镜像（`buildscript` + `allprojects` 双处） | ✅ 已改 |
| 4 | `spawnSync adb ENOENT` | 安装完成后 CLI 要用 PATH 里的 `adb` 拉起 Activity | 把 `platform-tools` 加进 PATH（本机 `.zshrc` 已有，只是非交互 shell 不加载） | ⚠️ 环境项，非代码 |
| 5 | `Cannot start server in new windows because no terminal app was specified` | CLI 想在新的终端窗口里跑 Metro 但失败 | 先手动 `npm start`，或用 `npm run android` 前另开终端 | ⚠️ 用法项，非代码 |
| 6 | 跨机器 `git pull` 后出现大量生成文件冲突 | `android/build/`、`android/.gradle/`、`.DS_Store` 被提交进仓库 | 从 git 索引移除 + 补进 `.gitignore` | ✅ 已改（待提交） |

---

## 1. 改动明细（逐条勾选）

### C1 — `android/local.properties`（新增，不提交）

- [x] 文件已创建，内容只有一行

```properties
sdk.dir=/Users/king/Library/Android/sdk
```

**为什么必须新建**：Gradle 找 SDK 只有三条路——环境变量 `ANDROID_HOME`、环境变量 `ANDROID_SDK_ROOT`、`android/local.properties` 里的 `sdk.dir`。你机器上前两个在非交互 shell 里都是空的，第三条文件不存在，于是根工程 `apply plugin` 阶段就崩，连编译都没开始。

**为什么不能提交**：这是机器专属路径。Mac 是 `/Users/...`，Windows 是 `C:\Users\...`，提交后必然把另一台机器搞挂。已加进 `.gitignore`。

**以后怎么改（新机器）**：

1. 确认 SDK 真实位置：Mac 默认 `~/Library/Android/sdk`，Windows 默认 `%LOCALAPPDATA%\Android\Sdk`。
2. 在 `android/` 目录下建 `local.properties`。
3. Windows 版注意反斜杠要转义：

```properties
sdk.dir=C\:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk
```

4. 更省事的替代方案（可选）：不加这个文件，改为在 shell 里导出环境变量。

```bash
# ~/.zshrc（Mac）
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
```

> 注意：环境变量只在**交互式**终端生效。IDE、GUI 启动的进程、脚本调用的非登录 shell 都读不到，所以 `local.properties` 更稳，建议始终保留。

---

### C2 — ABI 不再写死（`android/gradle.properties` + `package.json`）

- [x] `android/gradle.properties`：把 `reactNativeArchitectures=x86_64` 注释掉，并写明原因

```properties
# 这里不要写死单一 ABI：本文件随 git 同步到 Windows 机器，
# macOS 的模拟器/真机是 arm64-v8a，Windows 的模拟器通常是 x86_64，写死必然有一端装不上。
# 默认（不设此值）会构建全部 ABI，两端都能用；只想构建当前设备架构时用：
#   npm run android                              -> 带 --active-arch-only，自动取连接设备的 ABI
#   ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a
# reactNativeArchitectures=arm64-v8a
```

- [x] `package.json`：脚本改为按设备架构构建

```json
"android": "react-native run-android --active-arch-only",
"android:all": "react-native run-android",
```

**为什么这么改**：`gradle.properties` 是提交进仓库的共享文件，任何写死的 ABI 都会让另一台机器构建出错误的 so 库。Apple Silicon 的模拟器/真机全是 `arm64-v8a`，Windows 上的模拟器绝大多数是 `x86_64`，两边的正确值天然不同——所以正确解法不是"选一个值"，而是"不要在这个文件里给值"。

`--active-arch-only` 会先读连接设备的 `ro.product.cpu.abi`，再把值以 `-PreactNativeArchitectures=...` 传给 Gradle，效果等同手动指定，但自动完成。

**验证方式**（构建后检查 APK 内的 so 目录）：

```bash
cd android/app/build/outputs/apk/debug
unzip -l app-debug.apk | grep -o "lib/[a-z0-9-]*/" | sort -u
```

本次实际输出：

```
lib/arm64-v8a/
lib/armeabi-v7a/
lib/x86/
```

其中 `arm64-v8a` 是 App 自身（Hermes / Reanimated / Worklets）编出来的，另外两个来自预编译的 AAR，无碍。

**以后的取舍**：

| 场景 | 命令 | 说明 |
| --- | --- | --- |
| 日常开发（已连设备） | `npm run android` | 只编当前设备架构，最快 |
| 没连设备 / 想编全架构 | `npm run android:all` | 编 arm64-v8a + armeabi-v7a + x86 + x86_64，慢但通用 |
| 只出包不安装 | `cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` | 适合打包给别人装 |
| 交给 CI 出通用包 | `./gradlew assembleRelease`（不传 `-P`） | 默认全架构 |

> 注意：`--active-arch-only` 的前提是**恰好连着设备**。没设备时会退回全架构构建，不会报错但很慢；接了多台设备时它取第一台的 ABI，另一端要装就得换用 `android:all`。

---

### C3 — Maven 镜像前置（`android/build.gradle`）

- [x] 根工程 `buildscript.repositories` 里，镜像放在 `google()` / `mavenCentral()` **之前**

```groovy
buildscript {
    repositories {
        // 国内直连 Maven Central 经常握手被断，把阿里云镜像放在最前面（找不到时仍会回落到 google()/mavenCentral()）
        maven { url "https://maven.aliyun.com/repository/public" }
        maven { url "https://maven.aliyun.com/repository/google" }
        maven { url "https://maven.aliyun.com/repository/gradle-plugin" }
        google()
        mavenCentral()
    }
    ...
}
```

- [x] 新增 `allprojects` 块，给**所有子工程（含它们的 buildscript）**也补一份镜像

```groovy
// 三方库（如 react-native-safe-area-context 的 buildscript、AGP 的 KSP classpath）用的是各自的仓库列表，
// 这里给所有 project（含 buildscript）也补上镜像，保证镜像排在它们自己声明的仓库之前。
allprojects {
    buildscript {
        repositories {
            maven { url "https://maven.aliyun.com/repository/public" }
            maven { url "https://maven.aliyun.com/repository/google" }
            maven { url "https://maven.aliyun.com/repository/gradle-plugin" }
        }
    }
    repositories {
        maven { url "https://maven.aliyun.com/repository/public" }
        maven { url "https://maven.aliyun.com/repository/google" }
        maven { url "https://maven.aliyun.com/repository/gradle-plugin" }
    }
}
```

**为什么要写两处**：第一处只覆盖根工程的插件 classpath；真正报错的是第三方库的**自身 classpath**（`react-native-safe-area-context` 的 spotless、`async-storage` 的 `_agp_internal_debug_kspClasspath`），它们在自己的 `build.gradle` 里声明 `mavenCentral()`，父工程的 `buildscript` 管不到。`allprojects` 里面的 `buildscript`/`repositories` 会在子工程执行前注入，因此顺序是"镜像 → 库自己的仓库"。

**为什么顺序重要**：Gradle 只有在 404（包不存在）时才会顺延下一个仓库；遇到网络层错误（握手被断、超时）会直接判构建失败，**不会**去试后面的镜像。所以镜像必须排在 `mavenCentral()` 前面，放后面等于没放。

**为什么保留 `google()` / `mavenCentral()`**：镜像未同步的冷门包（尤其是新发布的）可以直接回落到官方源，避免镜像缺包导致诡异的不一致。

**本次实测**：加镜像前，同一份代码连续两次分别在 spotless 和 kotlinpoet 的下载处失败；加镜像后一次通过。`curl` 测官方源是 200 且 0.7s，说明网络不是"不通"，而是并发下载时 TLS 握手被对端强行关闭。

**以后怎么改**：换网络环境（海外/公司内网带私服）时这段可以整块删掉，或者把私服地址放最前。如果只想在本机做、不想影响仓库，替代做法是 `~/.gradle/init.gradle`，但注意 init 脚本注入的仓库同样是"追加"，未必能抢到最前面，改项目文件更可控。

---

### C4 — 从 git 索引移除生成物

- [x] 执行了（本地文件均保留，只取消跟踪）

```bash
git rm -r --cached android/build android/.gradle
git rm --cached .DS_Store android/.DS_Store android/gradle/.DS_Store
```

**为什么**：这些是每台机器各自生成的中间产物。提交到仓库后，Windows 那边 `pull` 下来就是一堆"本地已修改"，两边任何一次构建都会产生新的脏改动；`autolinking.json` 这类文件还带着机器相关的路径，冲突后极易引起"明明装好了却找不到库"的诡异问题。

**以后怎么改**：任何 `build/`、`.gradle/`、`.cxx/`、`*.log`、IDE 配置（`.idea/`、`*.iml`）都不该进仓库。发现被跟踪了，一律 `git rm -r --cached <path>` + 补 `.gitignore`，注意**不要**漏掉 `--cached`，否则会把本地文件真删掉。

---

### C5 — `.gitignore` 补全

- [x] 当前内容（新增项见注释）

```
# Expo
.expo
dist/
web-build/
/node_modules

# Android
/android/app/build
/android/build          # 新增
/android/.gradle
/android/app/.cxx
# 每台机器的 SDK 路径不同，绝不能同步
/android/local.properties   # 新增

# macOS
.DS_Store               # 新增
```

**以后怎么改**：新增原生依赖后如果出现新的生成目录（例如接入 Camera 后可能产生 `.cxx`、`*.so` 的中间目录），按同样的方式补一行。原则是"能由命令重新生成的东西，都不入库"。

---

## 2. 提交前 checklist

- [ ] `git status` 确认改动范围：`.gitignore`、`android/build.gradle`、`android/gradle.properties`、`package.json` 四个修改，加若干 `D`（索引删除）
- [ ] 确认 `android/local.properties` **不在**待提交列表里（被 `.gitignore` 挡住才对）
- [ ] 提交：`git add -A && git commit -m "fix(android): 修复 SDK 定位、ABI 写死与依赖下载失败，清理入库的生成产物"`
- [ ] 推送后到 Windows 机器 `git pull`，按下面第 5 节走一遍

---

## 3. 验证流程（每次改完原生配置都建议走一遍）

1. **确认设备**：`adb devices` 必须有一行 `device`（模拟器 `emulator-5554 device` 也算）。
2. **起 Metro**：另开一个终端 `npm start`，等出现 `Dev server ready`。
3. **构建安装**：`npm run android`，预期结尾出现

```
BUILD SUCCESSFUL in Xm Ys
Installed on 1 device.
```

4. **确认没红屏**：模拟器里能看到 App 首页/Profile 页；终端里 Metro 打出 `BUNDLE ./index.js` 且没有 `ERROR`。
5. **查崩溃级日志**：

```bash
adb logcat -d -t 300 | grep -i "ReactNativeJS|FATAL|AndroidRuntime"
```

正常应只有业务日志（例如本项目实测有 `stored token in PushNotification: null`，属预期），无 `FATAL`。

---

## 4. 报错字典（下次直接对号入座）

| 报错片段 | 含义 | 一行修法 |
| --- | --- | --- |
| `SDK location not found` | Gradle 找不到 SDK | 建 `android/local.properties` 写 `sdk.dir=` |
| `The server may not support the client's requested TLS protocol versions` / `Remote host terminated the handshake` | 依赖下载被网络中断（不是 TLS 版本真的不兼容） | 镜像前置，见 C3；先排除网络/VPN 干扰 |
| `Could not resolve all artifacts for configuration 'classpath'` | 第三方库自身的插件依赖没下下来 | 同上，注意要覆盖子工程 `buildscript` |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | APK 里没有设备所需架构的 so | 去掉写死的 `reactNativeArchitectures`，用 `--active-arch-only` |
| `couldn't find DSO to load: libhermes.so` | 同上，架构错位导致运行时缺库 | 同上 |
| `spawnSync adb ENOENT` | PATH 里没有 adb | 把 `platform-tools` 加入 PATH |
| `Cannot start server in new windows ...` | CLI 无法自动开新终端跑 Metro | 先手动 `npm start`，或加 `--terminal` |
| `ksp-2.2.0-2.0.2 is too old for kotlin-2.2.10` | KSP 与 Kotlin 版本不匹配 | 仅警告，不影响构建；真要消除就把 `kotlinVersion` 与 KSP 对齐 |

---

## 5. 新机器接入 checklist（Windows）

- [ ] 装 JDK 17+（AGP 9 / Gradle 9.4.1 的硬要求；用 Android Studio 内置 JBR 也行）
- [ ] 装 Android SDK，至少包含 `platforms;android-37.0`、`build-tools;37.0.0`、`ndk;27.1.12297006`、`platform-tools`
- [ ] 在 `android/` 下建 `local.properties` 写 Windows 版 `sdk.dir`
- [ ] 确认 `adb devices` 能看到设备；模拟器镜像 ABI 是 `x86_64` 也没关系（脚本会自动适配）
- [ ] `npm install`（不要用 `npm ci` 之外的锁文件改动；两机保持同一份 `package-lock.json`）
- [ ] `npm start` + `npm run android`
- [ ] 若首次构建卡在下载，检查是否能访问 `https://maven.aliyun.com/repository/public`

> Windows 上额外的坑：路径长度限制（项目别放太深的目录）、Windows Defender 实时扫描会显著拖慢 Gradle（可把项目目录与 `~/.gradle` 加白名单）。

---

## 6. 已知但本次未处理（留待后续）

- [ ] **包名三套并存**：`namespace=com.goFlight`、`applicationId=com.king.demo`、源码目录 `java/com/rn_cli_demo/`。目前 `google-services.json` 的 `package_name` 是 `com.king.demo`，和 applicationId 对得上，所以不会拦构建；但接自定义原生模块时容易踩坑。建议统一为 `com.king.demo`（目录一并挪到 `java/com/king/demo/`）。
- [ ] **发布证书入库**：`my-release-key.jks` 及 `android/app/build.gradle` 里的明文口令。练手无妨，正式发版前必须移出仓库并改为从 `local.properties`/环境变量读取。
- [ ] **Gradle 内存**：当前 `org.gradle.jvmargs=-Xmx2048m`。接入 Camera/Location/Notification 等更多原生依赖后若出现 OOM 或 "Daemon disappeared"，提到 `-Xmx4096m`。
- [ ] **中文注释与现有代码风格**：本次改动引入中文注释，若团队有英文注释规范，提交前统一。
