import React from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Privacy = () => {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Privacy Policy - Vivoor</title>
        <meta name="description" content="Privacy Policy for Vivoor - learn how we protect your data on our decentralized streaming platform." />
        <link rel="canonical" href="https://vivoor.live/privacy" />
      </Helmet>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div {...fadeInUp} className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
              Privacy Policy
            </span>
          </h1>
          <p className="text-muted-foreground">Last Updated: October 6, 2025</p>
        </motion.div>

        <motion.div {...fadeInUp} className="space-y-8">
          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                Vivoor ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains 
                how we collect, use, and protect information when you use our decentralized streaming platform.
              </p>
              <p>
                As a Web3 platform built on blockchain technology, Vivoor operates differently from traditional 
                centralized services. We prioritize user privacy and data minimization.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-cyan/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">2. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <h3 className="font-semibold text-lg text-foreground">Wallet Information</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your Kaspa wallet address (publicly visible on blockchain)</li>
                <li>Encrypted authentication tokens for session management</li>
                <li>Transaction hashes and blockchain activity</li>
              </ul>

              <h3 className="font-semibold text-lg text-foreground mt-6">Profile Information</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Username and display name (chosen by you)</li>
                <li>Profile picture and banner image (if uploaded)</li>
                <li>Bio and channel description (optional)</li>
              </ul>

              <h3 className="font-semibold text-lg text-foreground mt-6">Content Data</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Live streams and video content you broadcast</li>
                <li>Clips you create or upload</li>
                <li>Chat messages and interactions</li>
                <li>Tips and transactions (recorded on blockchain)</li>
              </ul>

              <h3 className="font-semibold text-lg text-foreground mt-6">Technical Information</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>IP address and device information</li>
                <li>Browser type and version</li>
                <li>Usage statistics and analytics</li>
                <li>Stream quality and performance metrics</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-brand-pink/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">3. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>We use collected information to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide and maintain the streaming service</li>
                <li>Authenticate users via wallet connection</li>
                <li>Process cryptocurrency transactions and tips</li>
                <li>Display your profile and content to other users</li>
                <li>Improve platform performance and features</li>
                <li>Prevent fraud and abuse</li>
                <li>Comply with legal obligations</li>
                <li>Send important service notifications</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">4. Blockchain & Public Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p className="font-semibold text-foreground">Important: Blockchain data is public and permanent.</p>
              <p>
                When you use Vivoor, certain information is recorded on the Kaspa blockchain, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your wallet address</li>
                <li>All cryptocurrency transactions (tips, fees, payments)</li>
                <li>Transaction timestamps and amounts</li>
                <li>Smart contract interactions</li>
              </ul>
              <p className="font-semibold mt-4">
                This blockchain data is public, immutable, and cannot be deleted or modified by Vivoor or any other party.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-cyan/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">5. Data Storage & Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>We implement security measures to protect your data:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Encryption of sensitive data in transit and at rest</li>
                <li>Wallet addresses are hashed for internal use</li>
                <li>Secure session management and authentication</li>
                <li>Regular security audits and updates</li>
                <li>Limited access to user data by staff</li>
              </ul>
              <p className="mt-4">
                However, no method of transmission over the Internet is 100% secure. We cannot guarantee 
                absolute security of your data.
              </p>
              <p className="font-semibold mt-4 text-foreground">
                You are responsible for securing your wallet private keys. Vivoor never has access to your private keys.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-pink/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">6. Third-Party Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>Vivoor integrates with the following third-party services:</p>
              
              <h3 className="font-semibold text-lg text-foreground mt-4">Livepeer Network</h3>
              <p>
                Video streaming and transcoding infrastructure. Livepeer may collect technical data about streams.
              </p>

              <h3 className="font-semibold text-lg text-foreground mt-4">Kaspa Blockchain</h3>
              <p>
                All cryptocurrency transactions are processed on the Kaspa blockchain, a public ledger.
              </p>

              <h3 className="font-semibold text-lg text-foreground mt-4">Supabase</h3>
              <p>
                Database and authentication services. Supabase has its own privacy policy.
              </p>

              <p className="mt-4">
                These third parties have their own privacy policies. We are not responsible for their practices.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">7. Cookies & Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>We use cookies and similar technologies to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintain your session and keep you logged in</li>
                <li>Remember your preferences and settings</li>
                <li>Analyze usage patterns and improve the service</li>
                <li>Prevent fraud and abuse</li>
              </ul>
              <p className="mt-4">
                You can control cookies through your browser settings, but disabling cookies may affect 
                functionality of the Service.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-cyan/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">8. Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>We retain your data for as long as necessary to provide the Service, including:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Profile information: Until you delete your account</li>
                <li>Stream and clip data: Indefinitely or until you delete content</li>
                <li>Chat messages: Up to 30 days</li>
                <li>Transaction records: Permanently (recorded on blockchain)</li>
                <li>Analytics data: Up to 2 years</li>
              </ul>
              <p className="font-semibold mt-4 text-foreground">
                Note: Blockchain data cannot be deleted and will remain public permanently.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-pink/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">9. Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and associated data (except blockchain records)</li>
                <li>Export your data</li>
                <li>Opt out of marketing communications</li>
                <li>Object to certain data processing</li>
              </ul>
              <p className="mt-4">
                To exercise these rights, contact us through the platform. Please note that some data 
                (blockchain transactions) cannot be deleted due to the nature of blockchain technology.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">10. Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                Vivoor is not intended for children under 13. We do not knowingly collect personal information 
                from children under 13. If you are a parent and believe your child has provided us with personal 
                information, please contact us.
              </p>
              <p>
                Users between 13-18 must have parental consent to use Vivoor.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-cyan/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">11. International Data Transfers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                Vivoor operates globally. Your data may be transferred to and processed in countries other than 
                your country of residence. These countries may have different data protection laws.
              </p>
              <p>
                By using Vivoor, you consent to the transfer of your information to these countries.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-pink/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">12. Data Breaches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                In the event of a data breach that affects your personal information, we will notify you as 
                required by applicable law. We will also take steps to mitigate the impact and prevent future breaches.
              </p>
              <p className="font-semibold text-foreground mt-4">
                Remember: Vivoor does not have access to your wallet private keys. If your wallet is compromised, 
                contact your wallet provider immediately.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">13. Changes to Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of significant changes 
                by posting a notice on the platform or sending you a notification.
              </p>
              <p>
                Continued use of Vivoor after changes constitutes acceptance of the updated Privacy Policy.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-cyan/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">14. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                If you have questions about this Privacy Policy or how we handle your data, please contact us 
                through the Vivoor platform.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Privacy;
