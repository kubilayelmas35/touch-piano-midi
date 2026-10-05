import UIKit
import Capacitor

/// Full screen for playing with both hands: no bounce, edge swipes need a second swipe.
/// The home indicator is hidden from JS through the SystemBars plugin (Capacitor owns that property).
class SonatrioViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let web = webView else { return }
        web.allowsLinkPreview = false
        web.scrollView.bounces = false
        web.scrollView.alwaysBounceVertical = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
    }

    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return .all
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    // The window and its SonatrioViewController come from Main.storyboard (UISceneStoryboardFile); building a second
    // one here would start a second web view and bridge behind it.
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Practising with both hands on the screen: never dim or lock while the app is open.
        UIApplication.shared.isIdleTimerDisabled = true
    }

    func sceneWillResignActive(_ scene: UIScene) {
        UIApplication.shared.isIdleTimerDisabled = false
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
