# AliMiniAppSDK

Prebuilt CocoaPods distribution for the ALI MiniApp SDK.

## Release a new CocoaPods version

1. Update the podspec version in `AliMiniAppSDK.podspec`:

   ```ruby
   s.version = '<VERSION>'
   ```

2. Replace the binary artifacts under `iOS/` with the release builds:

   - `iOS/MiniApp.xcframework`
   - `iOS/MiniAppObjC.xcframework`

3. Update dependency versions in `AliMiniAppSDK.podspec` if the frameworks were built against newer dependency versions.

4. Commit the release changes:

   ```sh
   git add AliMiniAppSDK.podspec iOS/MiniApp.xcframework iOS/MiniAppObjC.xcframework
   git commit -m "Release AliMiniAppSDK <VERSION>"
   ```

5. Create and push a git tag that exactly matches `s.version`. The podspec source uses `s.version` as the tag, so the tag must be available remotely before pushing the podspec.

   ```sh
   git tag <VERSION>
   git push origin main
   git push origin <VERSION>
   ```

6. Lint the podspec with the private and public sources:

   ```sh
   pod lib lint AliMiniAppSDK.podspec --sources='https://github.com/Ali-Corp/PodSpecs.git,https://cdn.cocoapods.org/'
   ```

7. Push the podspec to the private specs repo:

   ```sh
   pod repo push ali-corp-podspecs AliMiniAppSDK.podspec --sources='https://github.com/Ali-Corp/PodSpecs.git,https://cdn.cocoapods.org/'
   ```

8. Verify CocoaPods can resolve the released version:

   ```sh
   pod spec which AliMiniAppSDK --version=<VERSION>
   ```

### Troubleshooting

#### `Unable to find a specification for AliMiniAppSDK`

This usually means CocoaPods is not using the private Ali specs source. Ensure the private specs repo is set up locally and include the private source whenever linting, pushing, or resolving this pod.

```sh
pod repo add ali-corp-podspecs https://github.com/Ali-Corp/PodSpecs.git
pod repo update ali-corp-podspecs
pod spec which AliMiniAppSDK --version=<VERSION> --sources='https://github.com/Ali-Corp/PodSpecs.git,https://cdn.cocoapods.org/'
```

If a consumer app fails with this error, add the private source before the public CDN in its `Podfile`:

```ruby
source 'https://github.com/Ali-Corp/PodSpecs.git'
source 'https://cdn.cocoapods.org/'
```
