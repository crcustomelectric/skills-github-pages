// Firebase Configuration
// IMPORTANT: Replace this with your own Firebase config from Firebase Console
// See FIREBASE_SETUP.md for instructions

const firebaseConfig = {
  apiKey: "AIzaSyDRyuFZAM-U70-cFlXJom3IHb5UhSMIYrI",
  authDomain: "manloader-ab285.firebaseapp.com",
  projectId: "manloader-ab285",
  storageBucket: "manloader-ab285.firebasestorage.app",
  messagingSenderId: "737435338955",
  appId: "1:737435338955:web:fd574b022c925f3b01734e"
};

// Initialize Firebase
let database;

function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        console.log("Firebase connected successfully!");
        return true;
    } catch (error) {
        console.error("Firebase initialization error:", error);
        alert("Database connection failed. Using local storage as fallback.");
        return false;
    }
}

// Export database for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { database, initializeFirebase };
}
