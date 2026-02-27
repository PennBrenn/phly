import { LevelEditor } from '@/builder/editor';
import { LoadingScreen } from '@/rendering/loadingScreen';

// Show loading screen while editor initializes
const loadingScreen = new LoadingScreen();
loadingScreen.setProgress(0.3);

const editor = new LevelEditor();

// Simulate loading progress
loadingScreen.setProgress(0.6);

editor.start();

// Hide loading screen after editor is ready
loadingScreen.setProgress(1.0);
setTimeout(() => {
  loadingScreen.hide();
}, 300);
