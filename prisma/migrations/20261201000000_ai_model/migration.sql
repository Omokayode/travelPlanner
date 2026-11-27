-- Settings → AI: which Ollama model plans trips (null = the server default).
ALTER TABLE "AppSettings" ADD COLUMN "aiModel" TEXT;
