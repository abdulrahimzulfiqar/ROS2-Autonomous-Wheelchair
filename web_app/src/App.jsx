import React, { useState, useEffect, useRef } from 'react';
import * as ROSLIB from 'roslib';
import { Mic, MapPin, StopCircle, Radio, Activity, LayoutDashboard, UserSquare2, LogOut, Users, Plus, Trash2, Navigation } from 'lucide-react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, getDocs, query, where, getCountFromServer } from 'firebase/firestore';

// ─── LocalStorage Session Helpers ───────────────────────────────────────────

const STORAGE_KEYS = {
  SESSION: 'wheelchair_session',
};

function getSession() {
  const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
  return stored ? JSON.parse(stored) : null;
}

function saveSession(user) {
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

// ─── Login Page ─────────────────────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const q = query(collection(db, 'accounts'), where("email", "==", email), where("password", "==", password));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      onLogin(user);
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Navigation size={48} color="var(--accent)" />
          <h1 style={{ marginTop: '1rem', fontSize: '1.5rem' }}>Smart Wheelchair</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@wheelchair.local"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Sign In
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          <strong style={{ color: 'var(--accent)' }}>Default Logins:</strong><br />
          Caregiver: admin@wheelchair.local / admin123<br />
          User: user@wheelchair.local / user123
        </div>
      </div>
    </div>
  );
}

// ─── User Dashboard ─────────────────────────────────────────────────────────

function UserDashboard({ connected, sendGoal, stopRobot, isListening, toggleListen, transcript, wakeWordMode, toggleWakeWord, locations }) {
  return (
    <div className="responsive-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <section className="panel voice-panel">
          <h2><Mic /> Voice Assistant</h2>
          <button
            className={`mic-button ${isListening ? 'listening' : ''}`}
            onClick={toggleListen}
            disabled={wakeWordMode}
            style={{ opacity: wakeWordMode ? 0.5 : 1, cursor: wakeWordMode ? 'not-allowed' : 'pointer' }}
          >
            <Mic size={48} color={isListening ? 'white' : 'black'} />
          </button>

          <div style={{ margin: '1rem 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={wakeWordMode}
                onChange={toggleWakeWord}
                style={{ width: '1.2rem', height: '1.2rem' }}
              />
              Always Listening (Wake Word: "Wheelchair")
            </label>
          </div>

          <p style={{ color: '#94a3b8' }}>
            {wakeWordMode ? 'Say "Wheelchair, go to Kitchen"' : 'Tap and say "Go to Kitchen"'}
          </p>
          {transcript && <div className="transcript">"{transcript}"</div>}
        </section>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <section className="panel" style={{ height: '100%' }}>
          <h2><MapPin /> Quick Destinations</h2>
          <div className="destinations">
            {locations.length === 0 ? (
              <p style={{ color: '#94a3b8', gridColumn: '1 / -1' }}>No locations configured yet. Ask your Caregiver to add locations.</p>
            ) : (
              locations.map(loc => (
                <button key={loc.id} onClick={() => sendGoal(loc.name, loc)}>
                  {loc.name}
                </button>
              ))
            )}
          </div>
          <button className="stop" onClick={stopRobot} style={{ marginTop: '2rem', padding: '2rem' }}>
            <StopCircle size={32} /> EMERGENCY STOP
          </button>
        </section>
      </div>
    </div>
  );
}

// ─── Caregiver Dashboard ────────────────────────────────────────────────────

function CaregiverDashboard({ connected, position, alerts, locations, lastAchieved }) {
  const [newName, setNewName] = useState('');
  const [newX, setNewX] = useState('');
  const [newY, setNewY] = useState('');
  const [newTheta, setNewTheta] = useState('0');

  const addLocation = async (e) => {
    e.preventDefault();
    if (!newName || !newX || !newY) return;

    await addDoc(collection(db, 'locations'), {
      name: newName.trim(),
      x: parseFloat(newX.toString().replace(',', '.')) || 0,
      y: parseFloat(newY.toString().replace(',', '.')) || 0,
      theta: parseFloat(newTheta.toString().replace(',', '.')) || 0,
    });
    
    setNewName(''); setNewX(''); setNewY(''); setNewTheta('0');
  };

  const deleteLocation = async (id) => {
    await deleteDoc(doc(db, 'locations', id));
  };

  return (
    <div className="responsive-grid">
      {/* Left Column: Location Management */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="panel">
          <h2><MapPin /> Add New Location</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Open <strong style={{ color: 'var(--accent)' }}>Foxglove Studio</strong>, hover over the map to read X, Y coordinates, then enter them below.
          </p>
          <form onSubmit={addLocation} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Location Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Kitchen" required />
            </div>
            <div className="responsive-form-grid">
              <div className="form-group">
                <label>X (meters)</label>
                <input type="number" step="0.01" value={newX} onChange={e => setNewX(e.target.value)} placeholder="2.50" required />
              </div>
              <div className="form-group">
                <label>Y (meters)</label>
                <input type="number" step="0.01" value={newY} onChange={e => setNewY(e.target.value)} placeholder="-1.00" required />
              </div>
              <div className="form-group">
                <label>Theta (rad)</label>
                <input type="number" step="0.01" value={newTheta} onChange={e => setNewTheta(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              <Plus size={18} /> Add Location
            </button>
          </form>
        </div>

        <div className="panel">
          <h2><MapPin /> Saved Locations ({locations.length})</h2>
          {locations.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No locations saved yet.</p>
          ) : (
            <div className="table-container">
              <div className="locations-table">
                <div className="table-header">
                  <span>Name</span><span>X</span><span>Y</span><span>θ</span><span></span>
                </div>
                {locations.map(loc => (
                  <div key={loc.id} className="table-row">
                    <span style={{ fontWeight: 600 }}>{loc.name}</span>
                    <span className="coord-cell">{loc.x}</span>
                    <span className="coord-cell">{loc.y}</span>
                    <span className="coord-cell">{loc.theta}</span>
                    <button onClick={() => deleteLocation(loc.id)} className="btn-delete" title="Delete location">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Telemetry + Emergency */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="panel">
          <h2><Activity /> Telemetry Data</h2>
          <div className="tracking-display">
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Robot X Position</span>
            <span className="coordinate">{position.x} m</span>
          </div>
          <div className="tracking-display">
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Robot Y Position</span>
            <span className="coordinate">{position.y} m</span>
          </div>
          <div className="tracking-display" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Last Known Destination</span>
            <span className="coordinate" style={{ fontSize: '1.2rem', color: 'var(--success)' }}>
              {lastAchieved ? lastAchieved : 'Unknown'}
            </span>
          </div>
        </div>

        <div className="panel" style={{ flex: 1 }}>
          <h2><Activity /> Emergency Logs</h2>
          <div style={{ minHeight: '150px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', padding: '1rem', fontSize: '0.9rem', overflowY: 'auto', maxHeight: '350px' }}>
            {alerts.length === 0 ? (
              <span style={{ color: 'var(--success)' }}>Status: Normal. No alerts.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {alerts.map((alert, idx) => (
                  <div key={idx} className="emergency-alert" style={{ margin: 0 }}>
                    <Activity size={16} /> <strong>{alert.time}</strong>: {alert.msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Account Management ─────────────────────────────────────────────────────

function AccountManagement({ currentUser }) {
  const [accounts, setAccounts] = useState([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounts'), snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const addAccount = async (e) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) return;

    // Check if email already exists
    if (accounts.find(a => a.email === newEmail)) {
      alert('An account with this email already exists!');
      return;
    }

    await addDoc(collection(db, 'accounts'), {
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole,
    });
    setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('user');
  };

  const deleteAccount = async (id) => {
    if (id === currentUser.id) {
      alert("You cannot delete your own account!");
      return;
    }
    await deleteDoc(doc(db, 'accounts', id));
  };

  return (
    <div className="responsive-grid">
      {/* Add Account Form */}
      <div className="panel">
        <h2><Plus /> Add New Account</h2>
        <form onSubmit={addAccount} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="John Doe" required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@example.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)}>
              <option value="user">Wheelchair User</option>
              <option value="caregiver">Caregiver / Admin</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            <Plus size={18} /> Create Account
          </button>
        </form>
      </div>

      {/* Existing Accounts */}
      <div className="panel">
        <h2><Users /> Registered Accounts ({accounts.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {accounts.map(acc => (
            <div key={acc.id} className="account-card">
              <div>
                <strong>{acc.name}</strong>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>{acc.email}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`role-badge ${acc.role}`}>
                  {acc.role === 'caregiver' ? '🛡️ Caregiver' : '♿ User'}
                </span>
                {acc.id !== currentUser.id && (
                  <button onClick={() => deleteAccount(acc.id)} className="btn-delete" title="Delete account">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────

function App() {
  const [currentUser, setCurrentUser] = useState(getSession());
  const [connected, setConnected] = useState(false);
  const [rosUrl, setRosUrl] = useState(`ws://192.168.100.129:9090`);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [wakeWordMode, setWakeWordMode] = useState(false);
  const [position, setPosition] = useState({ x: '0.00', y: '0.00' });
  const [alerts, setAlerts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [activeDestination, setActiveDestination] = useState(null);
  const [lastAchieved, setLastAchieved] = useState(null);

  const ros = useRef(null);
  const goalPublisher = useRef(null);
  const odomSubscriber = useRef(null);
  const alertSubscriber = useRef(null);
  const recognition = useRef(null);
  const wakeWordRef = useRef(false);
  const locationsRef = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Load locations from Firebase
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'locations'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort alphabetically for clean UI
      data.sort((a,b) => a.name.localeCompare(b.name));
      setLocations(data);
      locationsRef.current = data;
    });
    return unsub;
  }, [currentUser]);

  // Load emergency alerts from Firebase
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'alerts'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort so newest alerts appear at the top
      data.sort((a, b) => b.timestamp - a.timestamp);
      setAlerts(data.slice(0, 50)); // Keep history of last 50 alerts
    });
    return unsub;
  }, [currentUser]);

  // Load last achieved destination from Firebase
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, 'state', 'last_destination'), snap => {
      if (snap.exists()) setLastAchieved(snap.data().name);
    });
    return unsub;
  }, [currentUser]);

  // Monitor physical arrivals using live ROS Odometry
  useEffect(() => {
    if (activeDestination) {
      const dx = parseFloat(position.x) - activeDestination.x;
      const dy = parseFloat(position.y) - activeDestination.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // If the robot gets within 0.5 meters of the requested goal coordinates, consider it successfully arrived
      if (dist < 0.5) {
        setDoc(doc(db, 'state', 'last_destination'), {
          name: activeDestination.name,
          timestamp: Date.now()
        }).catch(err => console.error("Error setting arrival", err));
        
        setActiveDestination(null);
      }
    }
  }, [position, activeDestination]);

  // Seed default admin account if DB is empty
  useEffect(() => {
    async function seedDefaults() {
      const snap = await getCountFromServer(collection(db, 'accounts'));
      if (snap.data().count === 0) {
        await addDoc(collection(db, 'accounts'), { name: 'Admin Caregiver', email: 'admin@wheelchair.local', password: 'admin123', role: 'caregiver' });
        await addDoc(collection(db, 'accounts'), { name: 'Default User', email: 'user@wheelchair.local', password: 'user123', role: 'user' });
      }
    }
    seedDefaults();
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentUser && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [currentUser, location.pathname]);

  useEffect(() => {
    if (currentUser) {
      initROS();
      initSpeechRecognition();
    }
    return () => {
      if (ros.current) ros.current.close();
    };
  }, [rosUrl, currentUser]);

  const handleLogin = (user) => {
    saveSession(user);
    setCurrentUser(user);
    navigate(user.role === 'caregiver' ? '/caregiver' : '/');
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setConnected(false);
    if (ros.current) ros.current.close();
    navigate('/login');
  };

  const initROS = () => {
    if (ros.current) ros.current.close();

    ros.current = new ROSLIB.Ros({ url: rosUrl });

    ros.current.on('connection', () => {
      setConnected(true);

      odomSubscriber.current = new ROSLIB.Topic({
        ros: ros.current,
        name: '/odom_raw',
        messageType: 'nav_msgs/Odometry'
      });

      odomSubscriber.current.subscribe((msg) => {
        setPosition({
          x: msg.pose.pose.position.x.toFixed(2),
          y: msg.pose.pose.position.y.toFixed(2)
        });
      });

      alertSubscriber.current = new ROSLIB.Topic({
        ros: ros.current,
        name: '/emergency_alerts',
        messageType: 'std_msgs/String'
      });

      alertSubscriber.current.subscribe(async (msg) => {
        try {
          // Idempotency Key: Guarantees that if the user has 3 phones open reading the same ROS stream,
          // they all write to the exact same Firebase Document, avoiding duplicate entries.
          const safeMsg = msg.data.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 30);
          const timeWindow = Math.floor(Date.now() / 5000); // 5-second overlap window
          const docId = `alert_${safeMsg}_${timeWindow}`;

          await setDoc(doc(db, 'alerts', docId), {
            time: new Date().toLocaleTimeString(),
            timestamp: Date.now(),
            msg: msg.data
          });
        } catch(e) { console.error("Firebase alerts error", e); }
      });
    });

    ros.current.on('error', () => {
      console.error('ROS Connection Error');
      setConnected(false);
    });

    ros.current.on('close', () => setConnected(false));

    goalPublisher.current = new ROSLIB.Topic({
      ros: ros.current,
      name: '/goal_pose',
      messageType: 'geometry_msgs/PoseStamped'
    });
  };

  const initSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false; // We use onend to restart manually
      recognition.current.interimResults = true; // Required for fast Mobile Chrome processing
      recognition.current.lang = 'en-US';

      recognition.current.onresult = (event) => {
        let text = "";
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }

        // Mobile speech APIs often add trailing periods or punctuation, which breaks string matching. Strip it out.
        text = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
        setTranscript(text + (isFinal ? "" : " ..."));

        if (isFinal) {
          if (wakeWordRef.current) {
            // Wake Word Mode: Only process if they say "wheelchair"
            if (text.includes('wheelchair')) {
              const command = text.split('wheelchair')[1] || text;
              processVoiceCommand(command.trim());
            } else {
              console.log("Ignored (no wake word):", text);
            }
          } else {
            processVoiceCommand(text);
          }

          // Force stop on Android to prevent indefinite listening lock after a command
          if (!wakeWordRef.current) {
            try { recognition.current.stop(); } catch(e) {}
          }
        }
      };

      recognition.current.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        setTranscript(`Mic Error: ${event.error}`);
        setIsListening(false);
      };

      recognition.current.onend = () => {
        setIsListening(false);
        // If Wake Word mode is ON, immediately restart listening
        if (wakeWordRef.current) {
          setTimeout(() => {
            if (wakeWordRef.current && recognition.current) {
              try {
                recognition.current.start();
                setIsListening(true);
              } catch (e) { }
            }
          }, 300); // slight delay avoids browser mic access spam
        }
      };
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }
  };

  const toggleWakeWord = () => {
    const newMode = !wakeWordMode;
    setWakeWordMode(newMode);
    wakeWordRef.current = newMode;

    if (newMode) {
      if (!isListening && recognition.current) {
        setTranscript('Wake Word active. Listening...');
        try {
          recognition.current.start();
          setIsListening(true);
        } catch (e) { }
      }
    } else {
      if (isListening && recognition.current) {
        recognition.current.stop();
        setIsListening(false);
        setTranscript('Wake Word disabled.');
      }
    }
  };

  const toggleListen = () => {
    if (isListening) {
      recognition.current.stop();
    } else {
      setTranscript('Listening...');
      recognition.current.start();
      setIsListening(true);
    }
  };

  const sendGoal = (destName, pose) => {
    // Determine connection dynamically since the React state might be stale
    // inside the Speech Recognition closure function
    const isCurrentlyConnected = ros.current && ros.current.isConnected;

    if (!isCurrentlyConnected) {
      alert("Not connected to Wheelchair ROS Network!");
      return;
    }

    setTranscript(`Navigating to ${destName}...`);

    const goalMsg = {
      header: {
        frame_id: 'map',
        stamp: { secs: 0, nsecs: 0 }
      },
      pose: {
        position: { x: pose.x, y: pose.y, z: 0.0 },
        orientation: { x: 0.0, y: 0.0, z: Math.sin(pose.theta / 2), w: Math.cos(pose.theta / 2) }
      }
    };

    setActiveDestination({ name: destName, x: parseFloat(pose.x), y: parseFloat(pose.y) });
    goalPublisher.current.publish(goalMsg);
  };

  const processVoiceCommand = (text) => {
    // Dynamically match voice commands against saved locations
    const locs = locationsRef.current;

    if (text.includes("stop")) {
      stopRobot();
      setTranscript("Emergency Stop Triggered by Voice");
      return;
    }

    for (const loc of locs) {
      if (text.includes(loc.name.toLowerCase())) {
        sendGoal(loc.name, loc);
        return;
      }
    }

    setTranscript("Command not recognized: " + text);
  };

  const stopRobot = async () => {
    const isCurrentlyConnected = ros.current && ros.current.isConnected;
    setActiveDestination(null); // Clear active physical destination tracking

    // Log the manual emergency stop to the persistent database
    try {
      if (currentUser) {
        await addDoc(collection(db, 'alerts'), {
          time: new Date().toLocaleTimeString(),
          timestamp: Date.now(),
          msg: `MANUAL EMERGENCY STOP TRIGGERED BY ${currentUser.name.toUpperCase()}`
        });
      }
    } catch(e) { console.error("Firebase alerts error", e); }

    if (!isCurrentlyConnected) return;

    // 1. Send zero velocity (stops manual teleop)
    const cmdVel = new ROSLIB.Topic({
      ros: ros.current,
      name: '/cmd_vel',
      messageType: 'geometry_msgs/Twist'
    });
    cmdVel.publish({
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 }
    });

    // 2. Cancel Nav2 Goals explicitly via the Action Server Cancellation Service
    // In roslibjs 2.1.0, ServiceRequest was removed, so we pass the raw object directly
    const cancelService = new ROSLIB.Service({
      ros: ros.current,
      name: '/navigate_to_pose/_action/cancel_goal',
      serviceType: 'action_msgs/srv/CancelGoal'
    });

    const cancelRequest = {
      goal_info: {
        goal_id: {
          uuid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Zeros mean cancel ALL goals
        },
        stamp: { sec: 0, nanosec: 0 }
      }
    };

    cancelService.callService(cancelRequest, (result) => {
      console.log('Nav2 stopped successfully:', result);
    }, (error) => {
      console.error('Failed to cancel Nav2 goal:', error);
    });

    setTranscript('Emergency Stop Activated! Halting robot...');
  };

  // If not logged in, show login page
  if (!currentUser) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
      </Routes>
    );
  }

  const isCaregiver = currentUser.role === 'caregiver';

  return (
    <div className="dashboard">
      <header>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={28} color="var(--accent)" /> Smart Wheelchair
          </h1>
          <nav className="nav-tabs" style={{ marginTop: '1rem' }}>
            <button
              onClick={() => navigate('/')}
              className={`nav-btn ${location.pathname === '/' ? 'active' : ''}`}
            >
              <UserSquare2 size={18} /> User App
            </button>
            {isCaregiver && (
              <>
                <button
                  onClick={() => navigate('/caregiver')}
                  className={`nav-btn ${location.pathname === '/caregiver' ? 'active' : ''}`}
                >
                  <LayoutDashboard size={18} /> Caregiver Admin
                </button>
                <button
                  onClick={() => navigate('/accounts')}
                  className={`nav-btn ${location.pathname === '/accounts' ? 'active' : ''}`}
                >
                  <Users size={18} /> Accounts
                </button>
              </>
            )}
          </nav>
        </div>
        <div className="header-actions">
          <div className="header-actions-row">
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              {currentUser.name} ({currentUser.role})
            </span>
            <button onClick={handleLogout} className="btn-logout" title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
          <div className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
            <Radio size={16} /> {connected ? 'Connected to ROS' : 'Offline'}
          </div>
          <div className="header-connection-row">
            <input
              type="text"
              value={rosUrl}
              onChange={(e) => setRosUrl(e.target.value)}
              className="ros-input"
            />
            <button onClick={initROS} className="btn-connect">
              Connect
            </button>
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={
          <UserDashboard
            connected={connected}
            sendGoal={sendGoal}
            stopRobot={stopRobot}
            isListening={isListening}
            toggleListen={toggleListen}
            transcript={transcript}
            wakeWordMode={wakeWordMode}
            toggleWakeWord={toggleWakeWord}
            locations={locations}
          />
        } />
        {isCaregiver && (
          <>
            <Route path="/caregiver" element={
              <CaregiverDashboard
                connected={connected}
                position={position}
                alerts={alerts}
                locations={locations}
                lastAchieved={lastAchieved}
              />
            } />
            <Route path="/accounts" element={
              <AccountManagement currentUser={currentUser} />
            } />
          </>
        )}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;
