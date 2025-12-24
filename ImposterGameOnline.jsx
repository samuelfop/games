import React, { useState, useEffect, useMemo } from 'react';
import { Users, Eye, EyeOff, Play, RotateCcw, HelpCircle, Check, X, Skull, Shuffle, UserPlus, Trash2, Sparkles, Loader2, Copy, LogOut } from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, collection, deleteDoc } from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
// FOR GITHUB PAGES: Replace the lines below with your actual firebaseConfig from the Firebase Console.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyA5o3sJx6ajDM6EUb2qiLp6l5TmwGI0-IQ",
  authDomain: "imposter-a3139.firebaseapp.com",
  projectId: "imposter-a3139",
  storageBucket: "imposter-a3139.firebasestorage.app",
  messagingSenderId: "760670204548",
  appId: "1:760670204548:web:b43fd90944589d7ceac8d1",
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'imposter-game-default';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Game Data (Same as before) ---
const INITIAL_GAME_DATA = {
  "Locations": [
    "Beach", "Hospital", "School", "Submarine", "Space Station", "Theater", 
    "Supermarket", "Pirate Ship", "Polar Station", "Desert", "Restaurant", 
    "Museum", "Train", "Airplane", "Casino", "Circus", "Bank", "Zoo", "Spa", "Library"
  ],
  "Food": [
    "Pizza", "Sushi", "Ice Cream", "Coffee", "Hamburger", "Spaghetti", 
    "Taco", "Pancakes", "Salad", "Steak", "Chocolate", "Soup", "Sandwich", 
    "Popcorn", "Donut", "Curry", "Cheese", "Apple"
  ],
  "Objects": [
    "Toaster", "Mirror", "Umbrella", "Bicycle", "Computer", "Guitar", 
    "Camera", "Clock", "Book", "Chair", "Shoes", "Television", "Toothbrush", 
    "Hammer", "Ladder", "Key", "Wallet", "Phone"
  ],
  "Jobs": [
    "Doctor", "Clown", "Teacher", "Police Officer", "Astronaut", "Chef", 
    "Farmer", "Artist", "Firefighter", "Pilot", "Mechanic", "Scientist", 
    "Magician", "Actor", "Judge", "Soldier", "Writer"
  ],
  "Animals": [
    "Lion", "Penguin", "Elephant", "Shark", "Eagle", "Snake", "Dog", 
    "Cat", "Monkey", "Giraffe", "Kangaroo", "Bear", "Octopus", "Spider", 
    "Frog", "Whale", "Bat", "Cow"
  ],
  "Hobbies": [
    "Fishing", "Gaming", "Dancing", "Painting", "Hiking", "Cooking", 
    "Photography", "Gardening", "Swimming", "Camping", "Reading", "Skiing", 
    "Knitting", "Singing", "Yoga"
  ]
};

// --- API Helper ---
const callGemini = async (prompt) => {
  const apiKey = ""; // Canvas handles key injection
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!response.ok) throw new Error("API call failed");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-800 border-2 border-slate-700 rounded-xl shadow-xl overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = "primary", className = "", disabled = false }) => {
  const baseStyle = "w-full py-4 px-6 rounded-lg font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-900/20",
    danger: "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-900/20",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200",
    outline: "border-2 border-slate-600 text-slate-300 hover:bg-slate-800",
    ghost: "text-slate-400 hover:text-white",
    ai: "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-fuchsia-900/20"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

export default function ImposterGameOnline() {
  // --- Local State ---
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // AI State
  const [customTopic, setCustomTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imposterTip, setImposterTip] = useState('');
  const [isGettingTip, setIsGettingTip] = useState(false);

  // --- Firebase Auth & Logic ---

  // 1. Authenticate
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Listen to Room Data
  useEffect(() => {
    if (!roomCode || !user) return;

    // Use a specific sub-collection for game rooms
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'imposter_rooms', roomCode);

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoomData(docSnap.data());
        setErrorMsg('');
      } else {
        setRoomData(null);
        // Don't auto-clear roomCode here to allow for re-creation or error correction
      }
    }, (err) => {
      console.error("Room sync error", err);
      setErrorMsg("Error syncing room data");
    });

    return () => unsubscribe();
  }, [roomCode, user]);

  // --- Actions ---

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, 0, O
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  const createRoom = async () => {
    if (!playerName.trim()) return setErrorMsg("Enter a name first!");
    if (!user) return setErrorMsg("Connecting to server...");

    const code = generateRoomCode();
    const newRoomData = {
      code,
      hostId: user.uid,
      status: 'lobby', // lobby, playing, revealed
      players: [{ uid: user.uid, name: playerName.trim(), isHost: true }],
      category: '',
      secretWord: '',
      imposterUid: '',
      firstPlayerIndex: 0,
      createdAt: Date.now()
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'imposter_rooms', code), newRoomData);
      setRoomCode(code);
    } catch (e) {
      console.error("Create failed", e);
      setErrorMsg("Failed to create room.");
    }
  };

  const joinRoom = async (codeToJoin) => {
    if (!playerName.trim()) return setErrorMsg("Enter a name first!");
    if (!codeToJoin) return setErrorMsg("Enter a room code!");
    const code = codeToJoin.toUpperCase();

    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'imposter_rooms', code);
      
      // We rely on Firestore security rules or optimistic updates, but strict path is key
      await updateDoc(roomRef, {
        players: arrayUnion({ uid: user.uid, name: playerName.trim(), isHost: false })
      });
      setRoomCode(code);
    } catch (e) {
      console.error("Join failed", e);
      setErrorMsg("Could not join room. Check code.");
    }
  };

  const leaveRoom = async () => {
    if (!roomCode || !user || !roomData) {
      setRoomCode('');
      setRoomData(null);
      return;
    }

    // Identify self to remove
    const myPlayer = roomData.players.find(p => p.uid === user.uid);
    if (myPlayer) {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'imposter_rooms', roomCode);
      await updateDoc(roomRef, {
        players: arrayRemove(myPlayer)
      });
    }
    setRoomCode('');
    setRoomData(null);
    setImposterTip('');
  };

  // --- Game Logic (Host Only triggers these usually) ---

  const startGame = async (category, customWords = null) => {
    if (!roomData) return;
    
    // Pick word and imposter
    const words = customWords || INITIAL_GAME_DATA[category];
    const word = words[Math.floor(Math.random() * words.length)];
    const imposterPlayer = roomData.players[Math.floor(Math.random() * roomData.players.length)];
    const firstIdx = Math.floor(Math.random() * roomData.players.length);

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'imposter_rooms', roomCode);
    await updateDoc(roomRef, {
      status: 'playing',
      category: category,
      secretWord: word,
      imposterUid: imposterPlayer.uid,
      firstPlayerIndex: firstIdx,
      startTime: Date.now()
    });
  };

  const revealGame = async () => {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'imposter_rooms', roomCode);
    await updateDoc(roomRef, { status: 'revealed' });
  };

  const resetGame = async () => {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'imposter_rooms', roomCode);
    await updateDoc(roomRef, { 
      status: 'lobby',
      category: '',
      secretWord: '',
      imposterUid: ''
    });
  };

  // --- AI Logic ---

  const handleAiCategory = async () => {
    if (!customTopic.trim()) return;
    setIsGenerating(true);
    const prompt = `Create a list of 20 distinct, well-known nouns related to the category: "${customTopic}". Strictly return ONLY a raw JSON array of strings.`;
    
    const result = await callGemini(prompt);
    if (result) {
      try {
        const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
        const words = JSON.parse(cleanJson);
        if (Array.isArray(words)) {
           // Start game directly with these words
           startGame(customTopic, words);
        }
      } catch(e) { console.error(e); }
    }
    setIsGenerating(false);
  };

  const handleAiTip = async () => {
    if (!roomData) return;
    setIsGettingTip(true);
    const prompt = `Game: Spyfall. Category: "${roomData.category}". I am the Imposter. Give 3 short, vague, safe words/phrases (1-2 words) to blend in. Format: "Try: [A], [B], or [C]"`;
    const res = await callGemini(prompt);
    if (res) setImposterTip(res);
    setIsGettingTip(false);
  };

  // --- Renders ---

  // 1. JOIN VIEW
  if (!roomCode || !roomData) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center justify-center font-sans max-w-md mx-auto">
        <header className="mb-8 text-center">
          <div className="inline-block p-3 bg-slate-800 rounded-full mb-3 border border-slate-700">
            <Users size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 uppercase italic">
            The Imposter
          </h1>
          <p className="text-slate-500 font-bold tracking-widest text-xs mt-2">ONLINE EDITION</p>
        </header>

        <Card className="w-full p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Name</label>
            <input 
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"
              placeholder="e.g. James Bond"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
            />
          </div>
          
          <div className="pt-4 border-t border-slate-700">
            <Button onClick={createRoom} className="mb-3">
              Create New Room
            </Button>
            
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-xs">OR JOIN</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <div className="flex gap-2">
              <input 
                className="flex-1 bg-slate-900 border border-slate-700 rounded p-3 text-center uppercase tracking-widest font-mono text-white focus:border-emerald-500 outline-none"
                placeholder="CODE"
                maxLength={4}
                onChange={(e) => {
                    if (e.target.value.length === 4) joinRoom(e.target.value);
                }}
              />
            </div>
          </div>
          {errorMsg && <p className="text-rose-400 text-sm text-center">{errorMsg}</p>}
        </Card>
      </div>
    );
  }

  const isHost = roomData.hostId === user?.uid;
  const myPlayer = roomData.players.find(p => p.uid === user?.uid);
  const isImposter = user?.uid === roomData.imposterUid;

  // 2. LOBBY VIEW
  if (roomData.status === 'lobby') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-4 font-sans max-w-md mx-auto flex flex-col">
        <header className="flex justify-between items-center py-4 mb-4">
           <button onClick={leaveRoom} className="p-2 text-slate-400 hover:text-rose-400"><LogOut size={20}/></button>
           <div className="text-center">
             <span className="text-xs text-slate-500 uppercase font-bold block">Room Code</span>
             <span className="text-3xl font-black font-mono tracking-widest text-emerald-400">{roomCode}</span>
           </div>
           <div className="w-8"></div> 
        </header>

        <Card className="flex-1 mb-4 flex flex-col">
          <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
            <h2 className="font-bold text-slate-200">Waiting for players...</h2>
            <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-400">{roomData.players.length} Joined</span>
          </div>
          <div className="p-4 space-y-2 overflow-y-auto flex-1">
            {roomData.players.map((p, i) => (
              <div key={p.uid} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded border border-slate-700/50">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
                  {i + 1}
                </div>
                <span className={`font-medium ${p.uid === user.uid ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {p.name} {p.uid === user.uid && "(You)"}
                </span>
                {p.isHost && <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">HOST</span>}
              </div>
            ))}
          </div>
        </Card>

        {isHost ? (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
             <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {Object.keys(INITIAL_GAME_DATA).map(cat => (
                  <button 
                    key={cat}
                    onClick={() => startGame(cat)}
                    className="bg-slate-800 p-3 rounded text-sm font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
                  >
                    {cat}
                  </button>
                ))}
             </div>
             
             {/* AI Input */}
             <div className="flex gap-2">
                <input 
                  value={customTopic}
                  onChange={e => setCustomTopic(e.target.value)}
                  placeholder="Or type custom topic..."
                  className="flex-1 bg-slate-800 border-slate-700 rounded px-3 text-sm text-white"
                />
                <Button variant="ai" className="w-auto px-4" onClick={handleAiCategory} disabled={isGenerating}>
                   {isGenerating ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>}
                </Button>
             </div>
          </div>
        ) : (
          <div className="text-center p-6 text-slate-500 text-sm animate-pulse">
            Waiting for Host to pick a topic...
          </div>
        )}
      </div>
    );
  }

  // 3. PLAYING VIEW
  if (roomData.status === 'playing') {
    const startPlayer = roomData.players[roomData.firstPlayerIndex];
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans flex flex-col items-center justify-center max-w-md mx-auto text-center">
        <h2 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">Game in Progress</h2>
        
        <Card className="w-full mb-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-slate-900/90 z-10 flex flex-col items-center justify-center group-hover:opacity-0 transition-opacity duration-300 cursor-pointer">
             <EyeOff size={48} className="text-slate-600 mb-2" />
             <p className="font-bold text-slate-400">TOUCH & HOLD TO REVEAL ROLE</p>
          </div>
          
          <div className="p-10 min-h-[300px] flex flex-col items-center justify-center">
             {isImposter ? (
                <>
                  <Skull size={64} className="text-rose-500 mb-4 animate-pulse" />
                  <h2 className="text-3xl font-black text-rose-500 uppercase tracking-tighter mb-2">YOU ARE THE IMPOSTER</h2>
                  <p className="text-slate-300 text-sm mb-6">Blend in. The category is:</p>
                  <div className="bg-slate-900 px-4 py-2 rounded text-xl font-bold text-white mb-6 border border-slate-700">
                    {roomData.category}
                  </div>
                  
                  {/* AI Tip */}
                  {!imposterTip ? (
                    <button 
                      onClick={handleAiTip}
                      disabled={isGettingTip}
                      className="text-xs flex items-center gap-1 text-violet-400 bg-violet-900/20 px-3 py-2 rounded-full hover:bg-violet-900/40"
                    >
                      {isGettingTip ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                      Get AI Bluffing Strategy
                    </button>
                  ) : (
                    <div className="bg-violet-900/20 border border-violet-500/30 p-3 rounded text-left text-xs italic text-violet-200">
                      {imposterTip}
                    </div>
                  )}
                </>
             ) : (
                <>
                   <div className="bg-emerald-500/10 p-4 rounded-full mb-4">
                      <div className="text-4xl">🤫</div>
                   </div>
                   <h2 className="text-slate-400 text-sm font-bold uppercase mb-2">You are Innocent</h2>
                   <h3 className="text-slate-500 text-xs uppercase mb-4">The Secret Word Is</h3>
                   <div className="text-4xl font-black text-emerald-400">{roomData.secretWord}</div>
                </>
             )}
          </div>
        </Card>

        <div className="mb-8">
           <p className="text-slate-400 text-sm">Starting Player:</p>
           <p className="text-xl font-bold text-white">{startPlayer?.name}</p>
        </div>

        {isHost && (
          <Button variant="danger" onClick={revealGame}>
            Stop & Vote / Reveal
          </Button>
        )}
      </div>
    );
  }

  // 4. REVEAL VIEW
  if (roomData.status === 'revealed') {
    const imposterName = roomData.players.find(p => p.uid === roomData.imposterUid)?.name || "Unknown";
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans flex flex-col items-center justify-center max-w-md mx-auto text-center">
        <h1 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-8">Round Over</h1>
        <Card className="w-full mb-6 p-8 space-y-8 bg-slate-800 border-slate-700">
          <div>
            <h3 className="text-rose-400 text-xs font-bold uppercase mb-2">The Imposter Was</h3>
            <div className="text-3xl font-black text-white">{imposterName}</div>
          </div>
          <div className="w-full h-px bg-slate-700"></div>
          <div>
            <h3 className="text-emerald-400 text-xs font-bold uppercase mb-2">The Secret Word Was</h3>
            <div className="text-3xl font-black text-white">{roomData.secretWord}</div>
          </div>
        </Card>

        {isHost ? (
          <Button onClick={resetGame}>Back to Lobby</Button>
        ) : (
          <p className="text-slate-500 text-sm animate-pulse">Waiting for host...</p>
        )}
      </div>
    );
  }

  return null;
}
