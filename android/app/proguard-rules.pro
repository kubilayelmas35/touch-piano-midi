# Capacitor + R8 (Play DEX optimization / obfuscation ≥ 25%).
# Capacitor's AAR already keeps Plugin subclasses and @PluginMethod callbacks.
# Full-mode R8 still needs the annotation interfaces themselves.

-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

-keep @interface com.getcapacitor.** { *; }

# Main activity is the launcher entry; keep the class name for the manifest.
-keep class com.sonatrio.app.MainActivity { *; }

# Optional backends some plugins compile against — missing at runtime is fine.
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**
-dontwarn com.android.billingclient.**
