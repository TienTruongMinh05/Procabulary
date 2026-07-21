Procabulary Engine V2.2

Procabulary Engine V2.2 is a English flashcard platform designed to optimize vocabulary retention. It combines modern web technologies with advanced linguistic analysis algorithms to help learners master academic English for IELTS, IT, and Business through a highly personalized learning path.  

Core Features

  Procab Algorithm (Priority-Based Selection): The system intelligently analyzes user performance and prioritizes words with higher "mistakes" counts stored in Firestore, ensuring that difficult vocabulary appears more frequently in study sessions.  
  
  Smart Feedback (Levenshtein + Backtracking): A sophisticated error-analysis engine that identifies four specific types of typing errors: Missing, Wrong, Extra, and Transposed characters.  
  Progressive Hinting: A two-stage verification mechanism that provides visual feedback on errors before revealing the correct answer, encouraging active recall and deeper memorization.  
  
  Multi-Device Audio System: Integrated Web Speech API supporting various accents (US, UK, AU) with adjustable playback speeds and specific fixes for iOS compatibility.  
  
  Custom Lesson Management: Empowers users to create, study, and manage their own vocabulary sets (up to 50 words per set) directly on their dashboard.  
  
  Mental Support System: Includes "Special Cards" featuring randomly generated encouraging messages and soft-toned UI elements to reduce learning stress. 

Tech Stack

Frontend: HTML5, CSS3 (Optimized Navy Deep UI), and Vanilla JavaScript.  
Backend & Database:Firebase Auth: For secure user authentication.  
Firebase Firestore: For storing dynamic user data, Procab scores, and custom lessons.  
Google Sheets (CSV): Acts as a flexible database for static academic vocabulary sets. 

Project Structure

script.js: Main controller for application state, rendering logic, and dashboard updates.
smafed.js: Contains the core Smart Feedback algorithm using Levenshtein distance calculations.  
procab.js: Manages interactions with Firebase Firestore for progress tracking and custom lesson CRUD operations.  
func.js: Handles UI events, audio configurations, and priority session logic.  
firebase.js: Firebase configuration and initialization. 

Security

Firestore Security Rules: Recursive rules ensure that users can only access their own scores and personal vocabulary sets.  
API Restrictions: API keys are restricted to specific authorized domains to prevent unauthorized resource usage. 
Roadmap
Implementation of Spaced Repetition System (SRS) algorithms (like SM-2) for optimized review scheduling.
Integration with Generative AI for automated sentence examples and contextual explanations.
Transitioning to a Progressive Web App (PWA) for offline learning capabilities.

