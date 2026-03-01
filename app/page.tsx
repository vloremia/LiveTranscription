"use client";

import App from "./components/App";

const Home = () => {
  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-[4rem] items-center bg-gradient-to-b from-black/50 to-black/10 backdrop-blur-[2px]">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-white">Live Transcription</h1>
        </header>
      </div>

      <main className="mx-auto h-[calc(100%-4rem)] px-4 md:px-6 lg:px-8">
        <App />
      </main>
    </div>
  );
};

export default Home;
