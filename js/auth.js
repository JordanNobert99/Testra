import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup, 
    GoogleAuthProvider,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Helper function to redirect based on user role
async function redirectToDashboard(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const userRole = userData.role;
            
            console.log('Redirecting user with role:', userRole);
            
            if (userRole === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'user-dashboard.html';
            }
        } else {
            console.error('User document not found');
            throw new Error('User profile not found');
        }
    } catch (error) {
        console.error('Error redirecting:', error);
        throw error;
    }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing auth...');

    // Form elements
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const toggleFormLink = document.getElementById('toggleFormLink');
    const toggleText = document.getElementById('toggleText');
    const formTitle = document.getElementById('formTitle');
    const errorMessage = document.getElementById('errorMessage');
    const googleLoginBtn = document.getElementById('googleLogin');
    const forgotPasswordLink = document.getElementById('forgotPassword');

    // Login form inputs
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    // Signup form inputs
    const signupNameInput = document.getElementById('signupName');
    const signupEmailInput = document.getElementById('signupEmail');
    const signupPasswordInput = document.getElementById('signupPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const agreeTermsCheckbox = document.getElementById('agreeTerms');

    // Debug: Check if elements are found
    console.log('Toggle link found:', toggleFormLink);
    console.log('Login form found:', loginForm);
    console.log('Signup form found:', signupForm);

    let isLoginMode = true;

    // Toggle between login and signup forms
    if (toggleFormLink) {
        toggleFormLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Toggle clicked! Current mode:', isLoginMode);
            hideError();
            
            isLoginMode = !isLoginMode;
            
            if (isLoginMode) {
                // Switch to login mode
                loginForm.classList.add('active');
                signupForm.classList.remove('active');
                formTitle.textContent = 'Welcome Back';
                toggleText.textContent = "Don't have an account?";
                toggleFormLink.textContent = 'Sign Up';
                console.log('Switched to login mode');
            } else {
                // Switch to signup mode
                signupForm.classList.add('active');
                loginForm.classList.remove('active');
                formTitle.textContent = 'Create Account';
                toggleText.textContent = 'Already have an account?';
                toggleFormLink.textContent = 'Login';
                console.log('Switched to signup mode');
            }
        });
    } else {
        console.error('Toggle link not found!');
    }

    // Handle login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError();
            
            const email = loginEmailInput.value.trim();
            const password = loginPasswordInput.value;
            const rememberMe = rememberMeCheckbox.checked;
            
            try {
                // Set persistence based on "Remember Me"
                const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
                await setPersistence(auth, persistence);
                
                // Sign in with email and password
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Update user last login in Firestore
                await updateUserLastLogin(user.uid);
                
                // Redirect based on role
                await redirectToDashboard(user.uid);
                
            } catch (error) {
                showError(getErrorMessage(error.code));
            }
        });
    }

    // Handle signup form submission
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError();
            
            const name = signupNameInput.value.trim();
            const email = signupEmailInput.value.trim();
            const password = signupPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const agreedToTerms = agreeTermsCheckbox.checked;
            
            // Validate inputs
            if (password !== confirmPassword) {
                showError('Passwords do not match.');
                return;
            }
            
            if (password.length < 8) {
                showError('Password must be at least 8 characters long.');
                return;
            }
            
            if (!agreedToTerms) {
                showError('You must agree to the Terms & Conditions.');
                return;
            }
            
            try {
                // Create user with email and password
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Update user profile with display name
                await updateProfile(user, {
                    displayName: name
                });
                
                // Create user profile in Firestore
                await createUserProfile(user, name, email);
                
                showSuccess('Account created successfully! Redirecting...');
                
                // Redirect based on role after 1.5 seconds
                setTimeout(async () => {
                    await redirectToDashboard(user.uid);
                }, 1500);
                
            } catch (error) {
                showError(getErrorMessage(error.code));
            }
        });
    }

    // Handle Google login
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            hideError();
            const provider = new GoogleAuthProvider();
            
            try {
                console.log('Starting Google sign-in...');
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                console.log('✅ Google sign-in successful!', user.uid);
                console.log('User email:', user.email);
                console.log('User name:', user.displayName);
                
                // Check if user exists in Firestore, if not create profile
                try {
                    console.log('Attempting to create/update user profile in Firestore...');
                    await createOrUpdateUserProfile(user);
                    console.log('✅ User profile created/updated successfully in Firestore!');
                } catch (dbError) {
                    console.error('❌ Firestore error:', dbError);
                    console.error('Error code:', dbError.code);
                    console.error('Error message:', dbError.message);
                    showError('Authentication successful, but failed to save user data: ' + dbError.message);
                    return; // Don't redirect if database save failed
                }
                
                // Redirect based on role
                console.log('Redirecting to dashboard...');
                await redirectToDashboard(user.uid);
                
            } catch (error) {
                console.error('❌ Google sign-in error:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                showError(getErrorMessage(error.code));
            }
        });
    }

    // Handle forgot password
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = loginEmailInput.value.trim();
            
            if (!email) {
                showError('Please enter your email address first.');
                return;
            }
            
            try {
                await sendPasswordResetEmail(auth, email);
                showSuccess('Password reset email sent! Check your inbox.');
            } catch (error) {
                showError(getErrorMessage(error.code));
            }
        });
    }

    // Helper function to create user profile in Firestore with complete data
    async function createUserProfile(user, displayName, email) {
        const userRef = doc(db, 'users', user.uid);
        
        const userData = {
            // Basic Info
            uid: user.uid,
            email: email,
            displayName: displayName,
            photoURL: user.photoURL || '',
            
            // Account Status
            role: 'user', // Default role: 'user', 'admin', 'moderator', etc.
            status: 'active', // 'active', 'suspended', 'banned'
            emailVerified: user.emailVerified,
            
            // Authentication Info
            authProvider: 'email', // 'email', 'google', 'facebook', etc.
            
            // Timestamps
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            updatedAt: serverTimestamp(),
            
            // Additional Fields (customize as needed)
            accountType: 'free', // 'free', 'premium', 'enterprise'
            settings: {
                notifications: true,
                newsletter: true
            }
        };
        
        await setDoc(userRef, userData);
        console.log('User profile created:', userData);
    }

    // Helper function to create or update user profile in Firestore
    async function createOrUpdateUserProfile(user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            // Create new user profile for Google sign-in
            const userData = {
                // Basic Info
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                
                // Account Status
                role: 'user', // Default role
                status: 'active',
                emailVerified: user.emailVerified,
                
                // Authentication Info
                authProvider: 'google',
                
                // Timestamps
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                updatedAt: serverTimestamp(),
                
                // Additional Fields
                accountType: 'free',
                settings: {
                    notifications: true,
                    newsletter: true
                }
            };
            
            await setDoc(userRef, userData);
            console.log('New Google user profile created:', userData);
        } else {
            // Update last login for existing user
            await updateUserLastLogin(user.uid);
        }
    }

    // Helper function to update last login
    async function updateUserLastLogin(uid) {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, {
            lastLogin: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });
    }

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.background = '#fee';
        errorMessage.style.color = '#c33';
        errorMessage.classList.add('show');
    }

    // Hide error message
    function hideError() {
        errorMessage.classList.remove('show');
    }

    // Show success message
    function showSuccess(message) {
        errorMessage.textContent = message;
        errorMessage.style.background = '#d4edda';
        errorMessage.style.color = '#155724';
        errorMessage.classList.add('show');
    }

    // Get user-friendly error messages
    function getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/operation-not-allowed':
                return 'Operation not allowed. Please contact support.';
            case 'auth/weak-password':
                return 'Password is too weak. Use at least 6 characters.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/user-not-found':
                return 'No account found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/invalid-credential':
                return 'Invalid email or password.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in popup was closed.';
            default:
                return 'An error occurred. Please try again.';
        }
    }

    // Check if user is already logged in and redirect to appropriate dashboard
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('User already logged in, checking role...');
            await redirectToDashboard(user.uid);
        }
    });
});