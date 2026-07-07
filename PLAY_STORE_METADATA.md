# Colorable - Google Play Store Listing Metadata

## 📝 General Information
* **Title:** Colorable: Magic Coloring Book
* **Short Description:** Transform your photos into physical, line-art coloring pages with local AI.
* **Full Description:**
Unleash your creativity with Colorable, a revolutionary interactive coloring book engine that turns your real-world photos into premium, composition-preserving line-art pages! 

Driven by an ultra-fast on-device AI model, Colorable converts faces, pets, memories, and landscapes into beautifully clean black-and-white outlines instantly. Perfect for parenting, therapy, relaxing, and artists of all ages.

🔒 ABSOLUTELY PRIVATE & OFFLINE
Colorable handles all photo processing 100% locally in your device's sandbox environment. No images are sent to database servers, ensuring total privacy for families. Perfect for kids!

✨ CORE FEATURES
• AI Photo-to-Sketch: Instantly turn any photo (JPEG, PNG, WebP) into outlines.
• Draw & Color Canvas: Paint directly in-app using realistic pencils, flood fill, and custom vibrant palettes.
• Portable PDF Book Export: Compile your favorite outlines into standard, high-quality printable PDF Coloring Books.
• Custom Bubble Text Overlays: Add name plaques, cute captions, or educational outlines to the top or bottom of your sheets.

---

## 🛠️ Step-by-Step Developer instructions: Wireless Debugging & APK Push

To push the fresh on-device, offline-powered compiled APK to your personal phone, execute the following steps on your workstation:

### Step 1: Pair and Connect Your Android Phone (Wireless Debugging)
1. Enable **Developer Options** on your phone (Go to Settings > About Phone > Tap "Build Number" 7 times).
2. Go to Settings > System > Developer Options and toggle **Wireless Debugging** to ON.
3. Tap "Wireless Debugging" to enter settings, then tap **Pair device with pairing code**. Write down the IP address, Port, and 6-digit Pairing Code.
4. On your PC terminal, run this pairing command (replacing with your details):
   ```bash
   adb pair <IP_ADDRESS>:<PORT> <PAIRING_CODE>
   ```
5. Look back at the main Wireless Debugging screen on your phone. Find the permanent dynamic IP and Port listed under "IP address & Port".
6. Run the connect command:
   ```bash
   adb connect <IP_ADDRESS_FROM_STEP_5>:<PORT_FROM_STEP_5>
   ```
7. Verify your phone shows up by typing:
   ```bash
   adb devices
   ```

### Step 2: Push and Install the Completed Local-Neural APK
Once connected, push the build directly to your mobile using:
```bash
adb install -r C:/Users/givin/github-repos/ColorableMobile/android/app/build/outputs/apk/debug/app-debug.apk
```
The console will say "Success" and the app icon will immediately appear on your phone's home screen!
