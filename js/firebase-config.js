// Firebase Configuration
// IMPORTANT: Replace this with your own Firebase config from Firebase Console
// See FIREBASE_SETUP.md for instructions

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
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
