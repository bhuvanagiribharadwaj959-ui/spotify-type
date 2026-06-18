"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { CheckCircle2, Eye, EyeOff, MailCheck, Music, RefreshCw } from "lucide-react";
import "./sign-up.css";
import { auth } from "../lib/firebase";
import { FirebaseError } from "firebase/app";
import { 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider,
  updateProfile,
  sendEmailVerification,
  signOut
} from "firebase/auth";
import { useRouter } from "next/navigation";

function authErrorMessage(err: unknown) {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Incorrect email or password. Please try again.";
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/weak-password":
        return "Your password is too weak. Please use a stronger password.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network error. Please check your internet connection.";
      case "auth/popup-closed-by-user":
        return "Sign-in popup was closed before completing.";
      case "auth/popup-blocked":
        return "Sign-in popup was blocked by your browser. Please allow popups for this site.";
      case "auth/cancelled-popup-request":
        return "Sign-in request was cancelled because a new one was started.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized for OAuth operations. Please check Firebase settings.";
      default:
        return `Error: ${err.message}`;
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Something went wrong. Please try again.";
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.78-.07-1.53-.2-2.25H12v4.26h6.35c-.27 1.46-1.08 2.7-2.29 3.56v2.96h3.71c2.17-2 3.43-4.96 3.43-8.53z" />
      <path fill="#34A853" d="M12 24c2.94 0 5.41-.97 7.22-2.63l-3.71-2.96c-1.03.7-2.34 1.12-3.51 1.12-2.7 0-4.99-1.82-5.81-4.27H2.41v2.68C4.2 21.98 7.85 24 12 24z" />
      <path fill="#FBBC05" d="M6.19 14.26c-.22-.66-.35-1.36-.35-2.08 0-.72.13-1.42.35-2.08V7.42H2.41C1.46 9.14.9 10.99.9 12.18c0 1.19.56 3.04 1.51 4.76l3.78-2.68z" />
      <path fill="#EA4335" d="M12 4.77c1.6 0 3.04.55 4.18 1.63l3.12-3.12C17.38 1.39 14.94 0 12 0 7.85 0 4.2 2.02 2.41 4.77l3.78 2.68C7.01 6.59 9.3 4.77 12 4.77z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.5 3 2.4 1.2-.05 1.7-.8 3.1-.8 1.4 0 1.9.8 3.1.7 1.3-.02 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.03-.02-2.6-1-2.6-3.9zM14.2 5.8c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.8-1.4z"/>
    </svg>
  );
}

function strengthOf(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

export function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const level = useMemo(() => strengthOf(pw), [pw]);
  
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false); 
  const [isResending, setIsResending] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.self !== window.parent) {
      setIsIframe(true);
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.emailVerified) {
        router.push("/dashboard");
      } else if (user && !user.emailVerified) {
        setIsVerifying(true);
      }
    });
      
    return () => unsubscribe();
  }, [router]);

  const verificationEmail = auth.currentUser?.email ?? email;

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error("Please sign up again so we can send a verification email.");
    }

    await sendEmailVerification(auth.currentUser, {
      url: `${window.location.origin}/login`,
    });
  };

  const checkVerificationStatus = async () => {
    if (!auth.currentUser) {
      setError("Please log in after opening the verification link from your email.");
      return;
    }

    setError("");
    setIsCheckingVerification(true);

    try {
      await auth.currentUser.reload();

      if (auth.currentUser.emailVerified) {
        setInfoMessage("Email verified. Redirecting you to log in...");
        await signOut(auth);
        router.push("/login");
        return;
      }

      setInfoMessage("Still waiting for verification. Open the email we sent, then come back here.");
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const resendVerification = async () => {
    setError("");
    setIsResending(true);

    try {
      await sendVerificationEmail();
      setInfoMessage("Verification email sent again. Check your inbox and spam folder.");
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  // 1. Manual Email & Password Registration Handler (With rollback security)
  const handle_signup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    if (!agree) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    
    let createdUser = null;

    try {
      // Create the user container in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, pw);
      createdUser = userCredential.user;
      
      if (createdUser) {
        if (name.trim()) {
          await updateProfile(createdUser, { displayName: name.trim() });
        }

        await sendVerificationEmail();
        
        setIsVerifying(true);
        setInfoMessage("Verification email sent. Open it to confirm your email address.");
      }
    } catch (err: unknown) {
      // Rollback: If the verification fails to send, delete the broken user state immediately
      if (createdUser) {
        try {
          await createdUser.delete();
        } catch (deleteErr) {
          console.error("Failed to clean up incomplete user registration:", deleteErr);
        }
      }
      
      if (err instanceof FirebaseError && err.code === "auth/email-already-in-use") {
        setError("This email address is already registered. Try logging in instead.");
      } else {
        setError(authErrorMessage(err));
      }
    }
  };

  // 2. Real-time background checking loop
  useEffect(() => {
    if (!isVerifying) {
      return;
    }

    intervalRef.current = setInterval(async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        
        if (auth.currentUser.emailVerified) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setInfoMessage("Email verified. Redirecting you to log in...");
          await signOut(auth);
          router.push("/login"); 
        }
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVerifying, router]);

  // 3. Google OAuth Provider Handler
  const handle_google_signup = async () => {
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    }
  };

  // 4. Apple OAuth Provider Handler
  const handle_apple_signup = async () => {
    setError("");
    try {
      await signInWithPopup(auth, new OAuthProvider("apple.com"));
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    }
  };

  return (
    <div className="sonic-signup-root">
      {/* Top Navigation */}
      <nav className="sonic-nav">
        <div className="sonic-logo" style={{ gap: '10px' }}>
          <img src="https://zgcbpjrvzmocydnlpexx.supabase.co/storage/v1/object/public/songs/logo.png" alt="Sonic" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          <span>Sonic</span>
        </div>
        <div className="sonic-nav-links">
          <a href="/discover">Discover</a>
          <a href="/library">Library</a>
          <a href="/artists">Artists</a>
          <a href="/premium">Premium</a>
        </div>
      </nav>

      {/* LEFT COLUMN - Hero Content */}
      <div className="sonic-left">
        <div className="sonic-hero">
          <div className="sonic-chip">
            <Music size={14} /> Trending this week
          </div>
          <h1 className="sonic-headline">
            Your music. Your world.<br />
            <em>Unfiltered.</em>
          </h1>
          <p className="sonic-sub">
            Discover 100 million songs, playlists crafted for every mood, and
            artists who move you — all in one immersive place.
          </p>

          <div className="sonic-hero-buttons">
            <button type="button" className="sonic-btn-primary" onClick={() => {
              const form = document.querySelector('.sonic-form');
              if (form) form.scrollIntoView({ behavior: 'smooth' });
            }}>Start Listening Free</button>
            <button type="button" className="sonic-btn-secondary" onClick={() => router.push('/premium')}>See Plans</button>
          </div>

          <div className="sonic-social-proof">
            <div className="sonic-avatars">
              <span style={{ background: "#FF7A00" }} />
              <span style={{ background: "#7C5CFF" }} />
              <span style={{ background: "#00E0FF" }} />
            </div>
            <span>Join 600M+ listeners worldwide</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Sign Up Form */}
      <div className="sonic-right">
        <div className="sonic-right-bg" />
        <div className="sonic-form-container">
          {isIframe && (
            <div className="sonic-iframe-banner" style={{
              color: "#eab308", 
              backgroundColor: "rgba(234, 179, 8, 0.1)", 
              padding: "12px 16px", 
              borderRadius: "8px", 
              marginBottom: "20px", 
              fontSize: "14px", 
              border: "1px solid rgba(234, 179, 8, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              lineHeight: "1.4"
            }}>
              <p style={{ margin: 0, fontWeight: "600" }}>
                ⚠️ Running inside a Hugging Face Space iframe
              </p>
              <p style={{ margin: 0, color: "#e2e8f0", fontSize: "13px" }}>
                Firebase Google & Apple login will fail due to iframe cookie restrictions. Please open Sonic directly in a new tab for it to work.
              </p>
              <button 
                type="button" 
                onClick={() => window.open(window.location.origin, "_blank")}
                style={{
                  background: "#eab308",
                  color: "#000",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  width: "fit-content",
                  marginTop: "4px"
                }}
              >
                Open Sonic directly
              </button>
            </div>
          )}

          <div className="sonic-form-header">
            <h2>Create your account</h2>
            <p>Get unlimited access to the world of music.</p>
          </div>

          {error && (
            <div className="sonic-error-message">
              {error}
            </div>
          )}

          {isVerifying && (
            <div className="sonic-verification-card" role="status" aria-live="polite">
              <div className="sonic-verification-icon">
                <MailCheck size={22} />
              </div>
              <div>
                <h3>Verify your email</h3>
                <p>
                  We sent a verification link to <strong>{verificationEmail}</strong>. Open it, then return here to continue.
                </p>
                {infoMessage && <span>{infoMessage}</span>}
                <div className="sonic-verification-actions">
                  <button type="button" onClick={checkVerificationStatus} disabled={isCheckingVerification}>
                    <CheckCircle2 size={16} />
                    {isCheckingVerification ? "Checking..." : "I verified"}
                  </button>
                  <button type="button" onClick={resendVerification} disabled={isResending}>
                    <RefreshCw size={16} />
                    {isResending ? "Sending..." : "Resend"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isVerifying && infoMessage && (
            <div className="sonic-info-message">{infoMessage}</div>
          )}

          <div className="sonic-social-logins">
            <button type="button" onClick={handle_google_signup} disabled={isVerifying}>
              <GoogleIcon /> Continue with Google
            </button>
            <button type="button" onClick={handle_apple_signup} disabled={isVerifying}>
              <AppleIcon /> Continue with Apple
            </button>
          </div>

          <div className="sonic-divider">
            <span>or continue with email</span>
          </div>

          <form className="sonic-form" onSubmit={handle_signup}>
            <div className="sonic-field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                placeholder="Jamie Doe"
                value={name}
                disabled={isVerifying}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="sonic-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                required
                disabled={isVerifying}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="sonic-field">
              <label htmlFor="pw">Password</label>
              <div className="sonic-input-wrap">
                <input
                  id="pw"
                  type={show ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={pw}
                  required
                  disabled={isVerifying}
                  onChange={(e) => setPw(e.target.value)}
                />
                <button
                  type="button"
                  className="sonic-pass-toggle"
                  onClick={() => setShow((s) => !s)}
                  disabled={isVerifying}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="sonic-strength" data-level={level}>
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <label className="sonic-check">
              <input
                type="checkbox"
                checked={agree}
                disabled={isVerifying}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span>
                I agree to the <a href="/terms">Terms of Service</a> and{" "}
                <a href="/privacy">Privacy Policy</a>.
              </span>
            </label>

            <button className="sonic-submit" type="submit" disabled={isVerifying}>
              {isVerifying ? "Awaiting Verification..." : "Sign up free"}
            </button>

            <div className="sonic-login-prompt">
              Already have an account? <a href="login">Log in</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
