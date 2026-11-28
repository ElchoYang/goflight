import UIKit
import React
internal import Expo

/// iOS 27 起强制使用 scene 生命周期，必须由 ExpoAppSceneDelegate 来建 window 并启动 React Native。
/// 它会从 AppDelegate（ExpoAppDelegate + ExpoReactNativeFactoryProvider）里取出工厂，
/// 并把 URL / 通知等生命周期事件转发回 AppDelegate 的订阅者。
class SceneDelegate: ExpoAppSceneDelegate {
}
