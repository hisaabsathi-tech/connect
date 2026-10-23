# R8 keep rules for release builds, added to android/app/build.gradle by app.config.ts.

# expo-task-manager restarts JS for a background task (the live-trip location task after Android
# killed the app) through a loader that expo-modules-core names only in manifest meta-data and
# creates by reflection. No library rule keeps it, so R8 removed it and headless starts failed.
-keep class * implements expo.modules.apploader.HeadlessAppLoader { <init>(); }
