// AliMiniAppSDKRemoteDependencies
//
// This module exists solely to anchor the remote SwiftPM dependencies that
// MiniApp.xcframework was compiled against. Binary targets cannot declare
// dependencies, so this empty source target bridges the gap: the consumer's
// linker resolves all transitive symbols through this module.
//
// Do not add public API here.
