plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.plugin.compose") }

android {
    namespace = "de.monopol.everything"
    compileSdk = 36
    defaultConfig { applicationId = "de.monopol.everything"; minSdk = 34; targetSdk = 35; versionCode = 5; versionName = "0.4.0" }
    buildFeatures { compose = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
    if (keystorePath != null) {
        signingConfigs { create("privateRelease") { storeFile = file(keystorePath); storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD"); keyAlias = System.getenv("ANDROID_KEY_ALIAS"); keyPassword = System.getenv("ANDROID_KEY_PASSWORD") } }
        buildTypes { getByName("release") { signingConfig = signingConfigs.getByName("privateRelease") } }
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.04.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.health.connect:connect-client:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    testImplementation("junit:junit:4.13.2")
}
