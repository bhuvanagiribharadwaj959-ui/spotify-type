"use client";
"use strict";

import { useState } from "react";
import React from "react";
import { Eye, EyeOff, Music, PlayCircle, PauseCircle, SkipForward, SkipBack } from "lucide-react";
import "./login.css";
import { auth } from "../lib/firebase";
import { FirebaseError } from "firebase/app";

import { 
  signInWithRedirect, 
  getRedirectResult,
  GoogleAuthProvider, 
  signOut,
  sendEmailVerification,
  signInWithEmailAndPassword,
  OAuthProvider,
  sendPasswordResetEmail
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

export function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const router = useRouter();

  React.useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          router.push("/dashboard");
        }
      })
      .catch((err) => {
        setError(authErrorMessage(err));
      });
  }, [router]);

  // 1. Core Email & Password Login Handler
  const handle_login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pw);
      const user = userCredential.user;

      // Email Verification Guardrail
      if (!user.emailVerified) {
        try {
          await sendEmailVerification(user);
          setError("Your email address hasn't been verified yet. We sent a new verification email. Please check your inbox or spam folder.");
        } catch {
          setError("Your email address hasn't been verified yet. Please check your inbox or spam folder.");
        } finally {
          await signOut(auth);
        }
        return;
      }

      // Success routing
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    }
  };

  // 2. Google OAuth Handler
  const handle_google_signup = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    }
  };

  // 3. Apple OAuth Handler 
  const handle_apple_signup = async () => {
    setError("");
    const provider = new OAuthProvider("apple.com");
    try {
      await signInWithRedirect(auth, provider);
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    }
  };

  // 4. Password Reset Handler
  const handle_reset_password = async () => {
    if (!email) {
      setError("Please enter your email address to reset your password.");
      setResetMessage("");
      return;
    }
    setError("");
    setResetMessage("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage("Password reset email sent! Check your inbox.");
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    }
  };

  return (
    <div className="sonic-login-root">
      {/* Top Navigation */}
      <nav className="sonic-nav">
        <div className="sonic-logo" style={{ gap: '10px' }}>
          <img src="https://zgcbpjrvzmocydnlpexx.supabase.co/storage/v1/object/public/songs/logo.png" alt="Sonic" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          <span>Sonic</span>
        </div>
        <div className="sonic-nav-links">
          <a href="/support">Support</a>
          <a href="/download">Download</a>
        </div>
      </nav>

      {/* LEFT COLUMN - Login Form */}
      <div className="sonic-login-left">
        <div className="sonic-form-container">
          <div className="sonic-form-header">
            <h2>Welcome back</h2>
            <p>Log in to pick up right where you left off.</p>
          </div>

          {/* Error Banner Injection */}
          {error && (
            <div className="sonic-error-banner" style={{ color: "#ff4a4a", backgroundColor: "rgba(255,74,74,0.1)", padding: "10px 14px", borderRadius: "6px", marginBottom: "20px", fontSize: "14px", border: "1px solid rgba(255,74,74,0.2)" }}>
              {error}
            </div>
          )}
          {resetMessage && (
            <div className="sonic-error-banner" style={{ color: "#4aff8a", backgroundColor: "rgba(74,255,138,0.1)", padding: "10px 14px", borderRadius: "6px", marginBottom: "20px", fontSize: "14px", border: "1px solid rgba(74,255,138,0.2)" }}>
              {resetMessage}
            </div>
          )}

          <div className="sonic-social-logins">
            <button type="button" onClick={handle_google_signup}>
              <GoogleIcon /> Log in with Google
            </button>
            <button type="button" onClick={handle_apple_signup}>
              <AppleIcon /> Log in with Apple
            </button>
          </div>

          <div className="sonic-divider">
            <span>or log in with email</span>
          </div>

          <form className="sonic-form" onSubmit={handle_login}>
            <div className="sonic-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="sonic-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="pw">Password</label>
                <button 
                  type="button" 
                  onClick={handle_reset_password} 
                  style={{ background: "none", border: "none", color: "#b3b3b3", fontSize: "12px", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                >
                  Forgot your password?
                </button>
              </div>
              <div className="sonic-input-wrap">
                <input
                  id="pw"
                  type={show ? "text" : "password"}
                  placeholder="Password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="sonic-pass-toggle"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button className="sonic-submit" type="submit">
              Log In
            </button>

            <div className="sonic-login-prompt">
              Don&apos;t have an account? <a href="sign-up">Sign up for free</a>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN - Hero Visuals */}
      <div className="sonic-login-right">
        <div className="sonic-hero-visuals">
          <div className="sonic-player-widget">
            <div className="sonic-player-art">
              <img 
                src="https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aW55bCUyMHJlY29yZCUyMHBsYXllciUyMG5lb258ZW58MXx8fHwxNzgwMjk2ODM2fDA&ixlib=rb-4.1.0&q=80&w=400" 
                alt="Album Art" 
              />
            </div>
            <div className="sonic-player-info">
              <div className="sonic-player-text">
                <h4>Midnight City Vibes</h4>
                <p>Curated by Sonic • 2.4M Likes</p>
              </div>
              <div className="sonic-player-controls">
                <button type="button" aria-label="Previous" onClick={() => setIsPlaying(false)}><SkipBack size={20} fill="currentColor" /></button>
                <button type="button" aria-label={isPlaying ? "Pause" : "Play"} className="sonic-play-btn" onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? <PauseCircle size={42} fill="currentColor" /> : <PlayCircle size={42} fill="currentColor" />}
                </button>
                <button type="button" aria-label="Next" onClick={() => setIsPlaying(false)}><SkipForward size={20} fill="currentColor" /></button>
              </div>
            </div>
          </div>
          
          <div className="sonic-floating-chip">
            <Music size={14} /> Resume your playlist
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
