import React from "react";
import { Helmet } from "react-helmet-async";

const Recordings: React.FC = () => {
  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>My Recordings — Vivoor</title>
        <meta name="description" content="View and manage your past Vivoor streams and recordings." />
        <link rel="canonical" href="/recordings" />
      </Helmet>
      <h1 className="sr-only">My Recordings</h1>
      <section className="rounded-xl border border-border p-4 bg-card/60 backdrop-blur-md">
        <div className="text-sm text-muted-foreground">This is a placeholder page. Your recordings will appear here.</div>
      </section>
    </main>
  );
};

export default Recordings;
