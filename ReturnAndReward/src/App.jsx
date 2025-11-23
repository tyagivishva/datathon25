import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithCustomToken, 
    onAuthStateChanged, 
    signOut,
    signInAnonymously
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    addDoc, 
    collection, 
    query, 
    where, 
    onSnapshot, 
    serverTimestamp,
    getDoc,
    orderBy,
    limit
} from 'firebase/firestore';
import { Camera, QrCode, Plus, MessageCircle, ArrowLeft, User, Package, LogOut, Upload, X, Scan, CornerUpLeft } from 'lucide-react';

// --- CONFIGURATION & FIREBASE INITIALIZATION ---

// Global variables provided by the Canvas environment (MANDATORY USE)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'return-and-reward-default';
const canvasConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Function to retrieve configuration from local .env.local file (Vite structure)
const getLocalConfig = () => {
    // Access local environment variables only if running in a Vite/Node environment
    try {
        if (typeof import.meta === 'undefined' || typeof import.meta.env === 'undefined') {
            return {};
        }
        return {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
    } catch (e) {
        return {}; // Return empty object if running where import.meta is unavailable (like in the online preview)
    }
};

const isValidConfig = (config) => {
    return config && typeof config === 'object' && config.apiKey && String(config.apiKey).length > 5;
};

let firebaseConfig = canvasConfig;
let firebaseInitialized = false;

// If Canvas config is missing, try to construct local config.
if (!isValidConfig(firebaseConfig)) {
    const tempLocalConfig = getLocalConfig();
    if (isValidConfig(tempLocalConfig)) {
        firebaseConfig = tempLocalConfig;
    }
}

let app;
let db;
let auth;

if (isValidConfig(firebaseConfig)) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        firebaseInitialized = true;
    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
    }
} else {
    console.warn("Firebase configuration is missing or invalid. Database and Authentication will be disabled.");
}

// Helper to get collection paths
const getPublicCollectionRef = (collectionName) => {
    if (!db) return null; 
    return collection(db, 'artifacts', appId, 'public', 'data', collectionName);
};

const getUserDocRef = (uid) => {
    if (!db) return null;
    return doc(db, 'artifacts', appId, 'users', uid, 'user_profile', 'data'); 
};

const getChatDocId = (uid1, uid2) => {
    const sortedUids = [uid1, uid2].sort();
    return sortedUids.join('_');
};

const fetchProfileByUid = async (uid) => {
    if (!db) return null;
    try {
        const docSnap = await getDoc(getUserDocRef(uid));
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
    }
    return null;
};

// --- GLOBAL MODAL AND AUTH LOGIC ---

// Placeholder for global modal function
let globalSetModal = () => console.warn("SetModal function not yet initialized.");

const CustomModal = ({ title, message, isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                        autoFocus
                    >
                        {onCancel ? 'Confirm' : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTS ---

// QR Code generation using API (for display/download, data is item ID)
const generateQRCode = (text) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
};

const LoginView = ({ handleGoogleSignIn, isAuthReady }) => {
    const isFirebaseReady = firebaseInitialized && auth;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100">
                <div className="text-center mb-10">
                    <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <QrCode className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Return&Reward</h1>
                    <p className="text-gray-600 font-medium">Your trusted lost and found network.</p>
                </div>
                
                {!isFirebaseReady && isAuthReady && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-lg">
                        <p className="font-bold">Error:</p>
                        <p className="text-sm">App configuration is missing. Login is disabled.</p>
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={!isFirebaseReady || !isAuthReady}
                        className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
                    >
                        <img 
                            src="https://www.gstatic.com/images/branding/product/2x/google_service_512dp.png" 
                            alt="Google Logo" 
                            className="w-5 h-5 mr-2"
                        />
                        Sign in with Google
                    </button>
                    {isAuthReady && <p className="text-xs text-gray-500 mt-4 text-center">Your items and profile will be secured using your Google account.</p>}
                </div>
            </div>
        </div>
    );
};

const ProfileSetupView = ({ handleProfileSetup, user, userProfile }) => {
    const [name, setName] = useState(user?.displayName || '');
    const [photo, setPhoto] = useState(user?.photoURL || null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploading(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhoto(reader.result); // Using base64 for profile photo as a simplified approach
                setUploading(false);
            };
            reader.onerror = () => {
                globalSetModal({ isOpen: true, title: "Error", message: 'Failed to load image.', onConfirm: () => globalSetModal({ isOpen: false }), onCancel: null });
                setUploading(false);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSubmit = () => {
        if (name.trim() && photo) {
            handleProfileSetup(name.trim(), photo);
        }
    };
    
    // Auto-fill name/photo from Google profile if available and profile is anonymous
    useEffect(() => {
        if (userProfile && userProfile.name === 'Anonymous User' && user?.displayName) {
            setName(user.displayName);
            setPhoto(user.photoURL);
        }
    }, [user, userProfile]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">Complete Your Profile</h2>
                
                <div className="space-y-6">
                    <div className="flex flex-col items-center">
                        <div 
                            onClick={() => !uploading && fileInputRef.current?.click()}
                            className="w-32 h-32 rounded-full bg-indigo-100 flex items-center justify-center cursor-pointer hover:bg-indigo-200 transition overflow-hidden border-4 border-white shadow-lg"
                        >
                            {uploading ? (
                                <div className="text-gray-500">Loading...</div>
                            ) : photo ? (
                                <img src={photo} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <Upload className="text-indigo-600" size={40} />
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                        />
                        <p className="text-sm text-gray-600 mt-2">
                            {photo ? 'Click to change photo' : 'Click to upload photo'}
                        </p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                    </div>
                    
                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim() || !photo || uploading}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
                    >
                        {uploading ? 'Processing...' : 'Create Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DashboardView = ({ userProfile, myItems, setView, handleLogout }) => {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-md border-b">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {userProfile?.photoURL && (
                            <img src={userProfile.photoURL} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500" />
                        )}
                        <div>
                            <h2 className="font-bold text-lg text-gray-800">Welcome back, {userProfile?.name.split(' ')[0] || 'User'}</h2>
                            <p className="text-sm text-gray-600">Your registered items: {myItems.length}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="text-gray-600 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
            <div className="max-w-4xl mx-auto p-4">
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => setView('add-item')}
                        className="bg-indigo-600 text-white py-4 rounded-xl font-extrabold hover:bg-indigo-700 transition flex flex-col items-center justify-center gap-1 shadow-lg transform hover:scale-[1.02]"
                    >
                        <Plus size={24} />
                        Add New Item
                    </button>
                    <button
                        onClick={() => setView('scan')}
                        className="bg-green-600 text-white py-4 rounded-xl font-extrabold hover:bg-green-700 transition flex flex-col items-center justify-center gap-1 shadow-lg transform hover:scale-[1.02]"
                    >
                        <Scan size={24} />
                        Find Lost Item
                    </button>
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">My Registered Items</h3>

                <div className="space-y-4">
                    {myItems.length === 0 ? (
                        <div className="bg-white rounded-xl p-10 text-center border-2 border-dashed border-indigo-300 shadow-inner">
                            <Package className="mx-auto text-indigo-400 mb-3" size={48} />
                            <p className="text-lg font-medium text-gray-600">No items added yet</p>
                            <p className="text-sm text-gray-500 mt-1">Click "Add New Item" to generate your first QR code.</p>
                        </div>
                    ) : (
                        myItems.map(item => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    setView('item-qr');
                                }}
                                className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition cursor-pointer border border-gray-200"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-gray-800">{item.itemName}</h4>
                                        <p className="text-sm text-gray-600">{item.description}</p>
                                    </div>
                                    <div className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                        item.status === 'returned' 
                                            ? 'bg-green-100 text-green-700 border border-green-300' 
                                            : 'bg-red-100 text-red-700 border border-red-300'
                                    }`}>
                                        {item.status.toUpperCase()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const AddItemView = ({ setView, handleAddItem }) => {
    const [itemName, setItemName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = () => {
        if (itemName.trim()) {
            handleAddItem(itemName.trim(), description.trim());
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-md border-b">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => setView('dashboard')} className="text-gray-600 hover:text-indigo-600 p-1 rounded-full hover:bg-gray-100">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-gray-800">Register New Item</h2>
                </div>
            </div>
            <div className="max-w-4xl mx-auto p-4">
                <div className="bg-white rounded-xl shadow-lg p-6 space-y-5 border border-gray-200">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Item Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="e.g., Laptop, Keys, Backpack"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Description (optional)</label>
                        <textarea
                            placeholder="e.g., Black, has a dent on the corner, name tag inside."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!itemName.trim()}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
                    >
                        Generate QR Code Sticker
                    </button>
                </div>
            </div>
        </div>
    );
};

const ItemQRView = ({ setView, selectedItem }) => {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-md border-b">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => setView('dashboard')} className="text-gray-600 hover:text-indigo-600 p-1 rounded-full hover:bg-gray-100">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-gray-800">QR Code for {selectedItem?.itemName}</h2>
                </div>
            </div>
            <div className="max-w-4xl mx-auto p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-6 border border-gray-200">
                    <h3 className="text-2xl font-extrabold text-indigo-700">{selectedItem?.itemName}</h3>
                    <p className="text-gray-600">{selectedItem?.description || 'No description provided.'}</p>
                        
                    <div className="bg-white p-6 rounded-xl inline-block border-4 border-indigo-500 shadow-xl">
                        <img 
                            src={generateQRCode(selectedItem?.id)} // QR code data is just the raw item ID
                            alt="QR Code"
                            className="w-64 h-64 mx-auto rounded"
                        />
                    </div>
                        
                    <div className="text-sm text-gray-600 space-y-2 pt-4 border-t">
                        <p className="font-bold text-gray-800">Unique Item ID:</p>
                        <code className="bg-gray-100 text-gray-700 p-2 rounded-lg inline-block font-mono text-xs break-all shadow-inner">{selectedItem?.id}</code>
                        <p>Print the QR code or write this ID on a tag and securely attach it.</p>
                        <p>If someone scans it, they instantly connect with you.</p>
                    </div>
                    <button
                        onClick={() => {
                            // Simple download simulation
                            const link = document.createElement('a');
                            link.href = generateQRCode(selectedItem?.id);
                            link.download = `${selectedItem?.itemName}-qr.png`;
                            link.click();
                        }}
                        className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg transform hover:scale-105"
                    >
                        Download Image
                    </button>
                </div>
            </div>
        </div>
    );
};

const ScanView = ({ setView, handleScanResult }) => {
    const [itemId, setItemId] = useState('');
    const [error, setError] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);
        if (itemId.trim()) {
            handleScanResult(itemId.trim()).catch(err => {
                setError(err.message);
            });
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-md border-b">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => setView('dashboard')} className="text-gray-600 hover:text-indigo-600 p-1 rounded-full hover:bg-gray-100">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-gray-800">Find Item</h2>
                </div>
            </div>
            <div className="max-w-4xl mx-auto p-4">
                <div className="bg-white rounded-xl shadow-lg p-6 space-y-6 border border-gray-200">
                    <div className="bg-green-50 p-6 rounded-xl border-2 border-dashed border-green-300 shadow-inner text-center">
                        <Scan size={64} className="mx-auto text-green-600 mb-2" />
                        <p className="font-extrabold text-lg text-gray-800">Simulate QR Scan</p>
                        <p className="text-sm text-gray-600">Enter the unique ID found on the item's tag or QR code.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <label className="block text-sm font-bold text-gray-700">Item ID from Sticker</label>
                        <input
                            type="text"
                            placeholder="Paste the unique item ID here"
                            value={itemId}
                            onChange={(e) => setItemId(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm shadow-sm"
                        />
                        {error && (
                            <div className="text-red-700 text-sm bg-red-100 p-3 rounded-xl border border-red-300 font-medium">{error}</div>
                        )}
                        <button
                            type="submit"
                            disabled={!itemId.trim()}
                            className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition disabled:bg-gray-400 shadow-md"
                        >
                            <Scan size={20} className="inline mr-2" /> Locate Owner
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const UserProfileView = ({ setView, selectedItem, selectedUser, handleStartChat, handleMarkReturned, userId }) => {
    const isOwner = selectedItem?.ownerId === userId;
    const isReturned = selectedItem?.status === 'returned';

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-md border-b">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => setView('dashboard')} className="text-gray-600 hover:text-indigo-600 p-1 rounded-full hover:bg-gray-100">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-gray-800">Item Details</h2>
                </div>
            </div>
            <div className="max-w-4xl mx-auto p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 space-y-8 border border-gray-200">
                    
                    <div className="text-center pb-6 border-b border-gray-200">
                        <h3 className="text-3xl font-extrabold text-indigo-700">{selectedItem?.itemName}</h3>
                        <p className="text-gray-600 text-base mt-2">{selectedItem?.description || 'No description provided'}</p>
                        <div className={`mt-4 inline-flex items-center px-4 py-1 text-sm font-bold rounded-full ${
                            isReturned ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'
                        }`}>
                            STATUS: {isReturned ? 'RETURNED' : 'MISSING'}
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        <h4 className="text-xl font-bold text-gray-800 mb-4">Owner Information</h4>
                        {selectedUser?.photoURL && (
                            <img src={selectedUser.photoURL} alt="Owner" className="w-24 h-24 rounded-full object-cover mb-3 border-4 border-indigo-500 shadow-md" />
                        )}
                        <h3 className="text-2xl font-bold text-gray-800">{selectedUser?.name}</h3>
                        <p className="text-gray-500 text-sm">{selectedUser?.email}</p>
                        <p className="text-gray-400 text-xs mt-2">Owner ID: {selectedItem?.ownerId}</p>
                    </div>

                    {!isOwner && (
                        <div className="pt-8 border-t border-gray-200 space-y-4">
                            {!isReturned && (
                                <button
                                    onClick={handleStartChat}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <MessageCircle size={20} />
                                    Contact Owner to Arrange Return
                                </button>
                            )}
                            
                            <button
                                onClick={handleMarkReturned}
                                disabled={isReturned}
                                className={`w-full py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md ${
                                    isReturned 
                                        ? 'bg-gray-400 text-white cursor-not-allowed' 
                                        : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                            >
                                {isReturned ? 'Item Has Been Returned' : 'I Have Returned the Item'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ChatView = ({ setView, selectedChat, currentUser, otherUser, handleSendMessage }) => {
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [selectedChat?.messages?.length]);

    const handleSend = () => {
        if (message.trim()) {
            handleSendMessage(message.trim());
            setMessage('');
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="bg-white shadow-md border-b">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => setView('user-profile')} className="text-gray-600 hover:text-indigo-600 p-1 rounded-full hover:bg-gray-100">
                        <CornerUpLeft size={24} />
                    </button>
                    {otherUser?.photoURL && (
                        <img src={otherUser.photoURL} alt="User" className="w-10 h-10 rounded-full object-cover border-2 border-gray-300" />
                    )}
                    <h2 className="text-xl font-bold text-gray-800">Chatting with {otherUser?.name || 'Owner'}</h2>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full">
                <div className="space-y-4">
                    {selectedChat?.messages?.map((msg) => {
                        const isMe = msg.senderId === currentUser.uid;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs md:max-w-md px-4 py-3 rounded-2xl shadow-md ${
                                    isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-tl-sm border border-gray-200'
                                }`}>
                                    <p>{msg.text}</p>
                                    <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>
                                        {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            
            <div className="bg-white border-t p-4 max-w-4xl mx-auto w-full">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && message.trim()) {
                                handleSend();
                            }
                        }}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!message.trim()}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-full font-bold hover:bg-indigo-700 transition disabled:bg-gray-400 shadow-md"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- MAIN APP COMPONENT ---

const App = () => {
    // Auth and User State
    const [user, setUser] = useState(null); // Firebase Auth User object
    const [userId, setUserId] = useState(null); // User UID
    const [isAuthReady, setIsAuthReady] = useState(false); // Flag for initial auth check completion
    const [userProfile, setUserProfile] = useState(null); // Full user profile data from Firestore

    // App Data State (Real-time synced from Firestore)
    const [users, setUsers] = useState({});
    const [items, setItems] = useState({});
    const [chats, setChats] = useState({});

    // UI/Navigation State
    const [view, setView] = useState('login'); 
    const [selectedItem, setSelectedItem] = useState(null); 
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedChat, setSelectedChat] = useState(null);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: null }); 
    
    // Set global modal function
    useEffect(() => {
        globalSetModal = setModal;
    }, []);


    // 1. Firebase Auth & Initial Sign-In (runs once)
    useEffect(() => {
        if (!firebaseInitialized || !auth) {
            setIsAuthReady(true);
            return;
        }

        const handleAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Initial auth failed, attempting anonymous sign-in:", error);
                await signInAnonymously(auth);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserId(currentUser.uid);
            } else {
                setUser(null);
                setUserId(null);
                setView('login');
            }
            setIsAuthReady(true);
        });

        handleAuth();
        return () => unsubscribe();
    }, []);

    // 2. Fetch User Profile (runs on userId change)
    useEffect(() => {
        if (!userId || !db || !isAuthReady) {
            setUserProfile(null);
            return;
        }
        
        const docRef = getUserDocRef(userId);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const profile = docSnap.data();
                setUserProfile(profile);
                // Redirect to dashboard if profile exists
                if (profile.name !== 'Anonymous User' && view === 'login') {
                    setView('dashboard');
                }
            } else {
                // If profile doesn't exist (e.g., initial anonymous sign-in), set placeholder
                setUserProfile({ uid: userId, name: 'Anonymous User', email: user?.email || 'N/A', photoURL: user?.photoURL || '' });
                if (view !== 'profile-setup') {
                     setView('profile-setup');
                }
            }
        }, (error) => {
            console.error("Error fetching user profile:", error);
        });

        return () => unsubscribe();
    }, [userId, isAuthReady, view, user]);


    // 3. Data Listeners (Items, Users, Chats)
    useEffect(() => {
        if (!userId || !db || !isAuthReady || !userProfile || userProfile.name === 'Anonymous User') return;

        // Listener for all Items
        const unsubscribeItems = onSnapshot(getPublicCollectionRef('items'), (snapshot) => {
            const loadedItems = {};
            snapshot.docs.forEach(doc => {
                loadedItems[doc.id] = { id: doc.id, ...doc.data() };
            });
            setItems(loadedItems);
        }, (error) => console.error("Error fetching items:", error));

        // Listener for all Users (limited for performance, only includes users with items)
        const usersQuery = query(getPublicCollectionRef('user_profiles'), limit(50));
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
            const loadedUsers = {};
            snapshot.docs.forEach(doc => {
                loadedUsers[doc.id] = { id: doc.id, ...doc.data() };
            });
            // Ensure the current user's profile is always up-to-date in the map
            loadedUsers[userProfile.uid] = userProfile;
            setUsers(loadedUsers);
        }, (error) => console.error("Error fetching users:", error));
        
        // Listener for current user's chats
        const chatsQuery = query(getPublicCollectionRef('chats'), where('participants', 'array-contains', userId));
        const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
            const loadedChats = {};
            snapshot.docs.forEach(doc => {
                loadedChats[doc.id] = { id: doc.id, ...doc.data() };
            });
            setChats(loadedChats);
        }, (error) => console.error("Error fetching chats:", error));


        return () => {
            unsubscribeItems();
            unsubscribeUsers();
            unsubscribeChats();
        };
    }, [userId, isAuthReady, userProfile]);

    // --- HANDLERS ---

    const handleGoogleSignIn = useCallback(() => {
        if (!auth) return;
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => {
            if (error.code !== 'auth/popup-closed-by-user') {
                globalSetModal({ isOpen: true, title: "Login Error", message: "Failed to sign in. Please try again or check console for details.", onConfirm: () => globalSetModal({ isOpen: false }), onCancel: null });
                console.error("Google Sign-In Error:", error);
            }
        });
    }, []);

    const handleLogout = useCallback(async () => {
        if (auth) {
            await signOut(auth);
            setSelectedItem(null);
            setSelectedUser(null);
            setSelectedChat(null);
        }
    }, []);

    const handleProfileSetup = useCallback(async (name, photoURL) => {
        if (!userId || !db) return;
        
        const profileData = {
            uid: userId,
            name: name,
            email: user?.email || 'N/A',
            photoURL: photoURL,
            createdAt: userProfile?.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            // Save profile to the user's private path (for security rules)
            await setDoc(getUserDocRef(userId), profileData, { merge: true });
            
            // Save a public copy for lookup purposes
            await setDoc(doc(getPublicCollectionRef('user_profiles'), userId), {
                uid: userId,
                name: name,
                photoURL: photoURL,
                email: user?.email || 'N/A',
            }, { merge: true });

            // State update is handled by the onSnapshot listener for userProfile
            setView('dashboard');
        } catch (error) {
            console.error('Error saving profile:', error);
            globalSetModal({ isOpen: true, title: "Error", message: 'Failed to save profile. Please try again.', onConfirm: () => globalSetModal({ isOpen: false }), onCancel: null });
        }
    }, [userId, user, userProfile]);

    const handleAddItem = useCallback(async (itemName, description) => {
        if (!userId || !db) return;

        try {
            const item = {
                itemName: itemName,
                description: description,
                ownerId: userId,
                status: 'missing', // default status
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(getPublicCollectionRef('items'), item);
            
            // Wait for item to appear in real-time 'items' state before navigating
            const newItem = { id: docRef.id, ...item };
            setSelectedItem(newItem);
            setView('item-qr');

        } catch (error) {
            console.error('Error adding item:', error);
            globalSetModal({ isOpen: true, title: "Error", message: 'Failed to add item. Please try again.', onConfirm: () => globalSetModal({ isOpen: false }), onCancel: null });
        }
    }, [userId]);

    const handleScanResult = useCallback(async (itemId) => {
        if (!db || !userId) throw new Error("App not initialized.");

        const item = items[itemId];

        if (!item) {
            throw new Error(`No item found with ID: ${itemId}`);
        }
        
        if (item.ownerId === userId) {
            // If the user scanned their own item, go to their QR view
            setSelectedItem(item);
            setView('item-qr');
            throw new Error('This is your own registered item.'); 
        }

        const ownerProfile = users[item.ownerId] || await fetchProfileByUid(item.ownerId);

        if (!ownerProfile) {
            throw new Error('Item found, but owner profile is missing or inaccessible.');
        }

        setSelectedItem(item);
        setSelectedUser(ownerProfile);
        setView('user-profile');
        return item;

    }, [items, userId, users]);

    const handleStartChat = useCallback(async () => {
        if (!selectedItem || !selectedUser || !userId) return;

        const otherUserId = selectedItem.ownerId;
        const chatId = getChatDocId(userId, otherUserId);

        try {
            // Ensure the top-level chat document exists
            const chatDocRef = doc(getPublicCollectionRef('chats'), chatId);
            await setDoc(chatDocRef, {
                participants: [userId, otherUserId].sort(),
                itemId: selectedItem.id,
                lastMessageAt: serverTimestamp(),
            }, { merge: true });

            // Find the chat in the state or set the new one
            const chat = chats[chatId] || { id: chatId, participants: [userId, otherUserId], messages: [] };
            setSelectedChat(chat);
            setView('chat');

        } catch (error) {
            console.error('Error starting chat:', error);
            globalSetModal({ isOpen: true, title: "Chat Error", message: 'Failed to start chat. Try again.', onConfirm: () => globalSetModal({ isOpen: false }), onCancel: null });
        }
    }, [selectedItem, selectedUser, userId, chats]);

    const handleSendMessage = useCallback(async (text) => {
        if (!selectedChat || !userId || !db) return;

        try {
            const chatDocRef = doc(getPublicCollectionRef('chats'), selectedChat.id);
            
            // 1. Add message to the subcollection
            await addDoc(collection(chatDocRef, 'messages'), {
                senderId: userId,
                text: text,
                timestamp: serverTimestamp(),
            });

            // 2. Update parent chat doc
            await setDoc(chatDocRef, { lastMessageAt: serverTimestamp() }, { merge: true });

        } catch (error) {
            console.error("Error sending message:", error);
            globalSetModal({ isOpen: true, title: "Error", message: 'Failed to send message.', onConfirm: () => globalSetModal({ isOpen: false }), onCancel: null });
        }
    }, [selectedChat, userId]);
    
    const handleMarkReturned = useCallback(() => {
        if (!selectedItem || !db) return;

        globalSetModal({
            isOpen: true,
            title: "Confirm Item Return",
            message: `Are you sure you want to mark "${selectedItem.itemName}" as returned? This action will notify the owner.`,
            onConfirm: async () => {
                setModal({ isOpen: false });
                try {
                    await setDoc(doc(getPublicCollectionRef('items'), selectedItem.id), { status: 'returned' }, { merge: true });
                    setSelectedItem(prev => ({ ...prev, status: 'returned' }));
                    globalSetModal({ isOpen: true, title: "Success", message: "Item marked as returned! Thank you for your honesty.", onConfirm: () => globalSetModal({ isOpen: false }), onCancel: null });
                } catch (error) {
                    console.error('Error marking item as returned:', error);
                    globalSetModal({ isOpen: true, title: "Error", message: "Failed to update item status.", onConfirm: () => globalSetModal({ isOpen: false }), onCancel: null });
                }
            },
            onCancel: () => setModal({ isOpen: false }),
        });
    }, [selectedItem]);
    
    // Listen for messages in the selected chat room
    useEffect(() => {
        if (!selectedChat || !db) return;

        const q = query(
            collection(getPublicCollectionRef('chats'), selectedChat.id, 'messages'),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSelectedChat(prev => ({ ...prev, messages: msgs }));
        }, (error) => {
            console.error("Error listening to chat messages:", error);
        });

        return () => unsubscribe();
    }, [selectedChat?.id]);


    // Filter user's items for dashboard
    const myItems = Object.values(items).filter(item => item.ownerId === userId).sort((a, b) => {
        // Sorts missing items first, then by creation date
        if (a.status === 'missing' && b.status !== 'missing') return -1;
        if (a.status !== 'missing' && b.status === 'missing') return 1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

    // Ensure selected item is updated when real-time state changes
    const currentItem = items[selectedItem?.id] || selectedItem;


    // --- VIEW RENDERING ---

    const renderView = () => {
        if (!isAuthReady) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100">
                    <div className="text-xl text-indigo-600 animate-pulse">Loading Application...</div>
                </div>
            );
        }

        switch (view) {
            case 'login':
                return <LoginView handleGoogleSignIn={handleGoogleSignIn} isAuthReady={isAuthReady} />;
            case 'profile-setup':
                return <ProfileSetupView handleProfileSetup={handleProfileSetup} user={user} userProfile={userProfile} />;
            case 'dashboard':
                return <DashboardView userProfile={userProfile} myItems={myItems} setView={setView} handleLogout={handleLogout} />;
            case 'add-item':
                return <AddItemView setView={setView} handleAddItem={handleAddItem} />;
            case 'item-qr':
                return <ItemQRView setView={setView} selectedItem={currentItem} />;
            case 'scan':
                return <ScanView setView={setView} handleScanResult={handleScanResult} />;
            case 'user-profile':
                if (!selectedUser || !currentItem) return <div className="p-4">Error: Missing item or user data.</div>;
                return <UserProfileView 
                    setView={setView} 
                    selectedItem={currentItem} 
                    selectedUser={selectedUser} 
                    handleStartChat={handleStartChat}
                    handleMarkReturned={handleMarkReturned}
                    userId={userId}
                />;
            case 'chat':
                if (!selectedChat || !selectedUser) return <div className="p-4">Error: Missing chat or user data.</div>;
                return <ChatView 
                    setView={setView} 
                    selectedChat={selectedChat} 
                    currentUser={user} 
                    userProfile={userProfile}
                    otherUser={selectedUser}
                    handleSendMessage={handleSendMessage}
                />;
            default:
                return <DashboardView userProfile={userProfile} myItems={myItems} setView={setView} handleLogout={handleLogout} />;
        }
    };

    return (
        <>
            {renderView()}
            <CustomModal
                title={modal.title}
                message={modal.message}
                isOpen={modal.isOpen}
                onConfirm={modal.onConfirm}
                onCancel={modal.onCancel}
            />
        </>
    );
};

export default App;