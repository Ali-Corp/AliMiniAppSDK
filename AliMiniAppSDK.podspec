Pod::Spec.new do |s|
  s.name             = 'AliMiniAppSDK'
  s.version          = '5.10.1'
  s.summary          = 'Prebuilt xcframework distribution of the ALI MiniApp SDK.'
  s.description      = <<~DESC
    AliMiniAppSDK ships MiniApp and MiniAppObjC as prebuilt xcframeworks, providing
    the Mini App runtime — including WebView rendering, JS bridge, navigation, and
    lifecycle management — behind a clean binary interface. All required third-party
    dependencies are declared and resolved by the package manager.
  DESC

  s.homepage         = 'https://github.com/Ali-Corp/AliMiniAppSDK'
  s.license          = { type: 'MIT', file: 'LICENSE.md' }
  s.author           = { 'ALI Corp' => 'developer@ali.vn' }
  s.source           = { git: 'https://github.com/Ali-Corp/AliMiniAppSDK', tag: s.version.to_s }

  s.platform         = :ios, '15.0'
  s.swift_version    = '5.9'

  # Prebuilt xcframeworks — binary distribution of MiniApp + MiniAppObjC.
  s.vendored_frameworks = [
    'iOS/MiniApp.xcframework',
    'iOS/MiniAppObjC.xcframework',
  ]

  # Include the precompiled MiniApp resource bundle from one xcframework slice.
  s.resources = 'iOS/MiniApp.xcframework/ios-arm64/MiniApp.framework/MiniApp_MiniApp.bundle'

  s.static_framework = true

  # Remote CocoaPods dependencies — the four third-party libraries that
  # MiniApp.xcframework was compiled against.
  s.dependency 'ZIPFoundation', '~> 0.9'
  s.dependency 'TrustKit',      '~> 2.0'
  s.dependency 'SQLite.swift',  '~> 0.15'
  s.dependency 'SwiftyJSON',    '~> 5.0'
end
