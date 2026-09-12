import Foundation
import Capacitor

/**
 * RebootCheck — a tiny app-local Capacitor plugin.
 *
 * getBootTime() returns the wall-clock time (milliseconds since the Unix
 * epoch) at which the device last booted, read from the kernel via
 * sysctl(KERN_BOOTTIME). This is a real stored timestamp, NOT "now minus
 * uptime": ProcessInfo.systemUptime does not advance while the device is
 * asleep, so a derived boot time would creep forward every time the phone
 * is locked in a pocket and wrongly look like a reboot. KERN_BOOTTIME
 * only moves on an actual restart (plus a small shift whenever the wall
 * clock is corrected, which the JS side absorbs with a few minutes of
 * tolerance — see src/utils/biometricAuth.js).
 *
 * Used by the biometric-unlock session policy (DEV-8 phase 4): after a
 * reboot the app requires a full password/Google sign-in again instead of
 * offering Face ID / Touch ID over the persisted session.
 *
 * No entitlement or Apple Developer account is required — sysctl
 * KERN_BOOTTIME is unprivileged.
 *
 * Being compiled into the App target does NOT make this reachable from
 * JS: it also has to be registered on the bridge, which MainViewController
 * does. Without that the JS proxy rejects every call with "not
 * implemented" and the reboot half of the policy is skipped (the 30-day
 * half still applies).
 */
@objc(RebootCheckPlugin)
public class RebootCheckPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RebootCheckPlugin"
    public let jsName = "RebootCheck"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getBootTime", returnType: CAPPluginReturnPromise)
    ]

    @objc func getBootTime(_ call: CAPPluginCall) {
        var mib: [Int32] = [CTL_KERN, KERN_BOOTTIME]
        var bootTime = timeval()
        var size = MemoryLayout<timeval>.stride

        let status = mib.withUnsafeMutableBufferPointer { pointer -> Int32 in
            sysctl(pointer.baseAddress, 2, &bootTime, &size, nil, 0)
        }

        guard status == 0 else {
            call.reject("sysctl KERN_BOOTTIME failed (errno \(errno))")
            return
        }

        let bootTimeMs = Double(bootTime.tv_sec) * 1000.0 + Double(bootTime.tv_usec) / 1000.0
        call.resolve(["bootTime": bootTimeMs])
    }
}
