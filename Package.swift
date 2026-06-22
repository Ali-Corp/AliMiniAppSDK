// swift-tools-version: 5.9
import PackageDescription

// Binary targets cannot declare dependencies in SwiftPM, so all remote
// packages are pulled in through a thin carrier source target
// (AliMiniAppSDKRemoteDependencies) that lives alongside the binaries in the
// product. The consumer gets a single product — "AliMiniAppSDK" — and all
// transitive links resolve automatically.
let package = Package(
    name: "AliMiniAppSDK",
    defaultLocalization: "en",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "AliMiniAppSDK",
            targets: [
                "MiniApp",
                "MiniAppObjC",
                "AliMiniAppSDKRemoteDependencies",
            ]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/weichsel/ZIPFoundation.git", from: "0.9.16"),
        .package(url: "https://github.com/datatheorem/TrustKit.git", from: "2.0.1"),
        .package(url: "https://github.com/stephencelis/SQLite.swift.git", from: "0.15.3"),
        .package(url: "https://github.com/SwiftyJSON/SwiftyJSON.git", from: "5.0.1"),
    ],
    targets: [
        // ── Prebuilt xcframeworks ──────────────────────────────────────────
        .binaryTarget(name: "MiniApp",      path: "iOS/MiniApp.xcframework"),
        .binaryTarget(name: "MiniAppObjC",  path: "iOS/MiniAppObjC.xcframework"),

        // ── Carrier target: wires remote deps into the product ─────────────
        .target(
            name: "AliMiniAppSDKRemoteDependencies",
            dependencies: [
                .product(name: "ZIPFoundation", package: "ZIPFoundation"),
                .product(name: "TrustKit",      package: "TrustKit"),
                .product(name: "SQLite",        package: "SQLite.swift"),
                .product(name: "SwiftyJSON",    package: "SwiftyJSON"),
            ],
            path: "Sources/AliMiniAppSDKRemoteDependencies"
        ),
    ]
)
