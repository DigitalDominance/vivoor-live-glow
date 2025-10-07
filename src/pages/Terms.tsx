import React from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Terms = () => {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Terms of Service - Vivoor</title>
        <meta name="description" content="Terms of Service for Vivoor - the world's first Kaspa-powered live streaming platform." />
        <link rel="canonical" href="https://vivoor.live/terms" />
      </Helmet>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div {...fadeInUp} className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
              Terms of Service
            </span>
          </h1>
          <p className="text-muted-foreground">Last Updated: October 6, 2025</p>
        </motion.div>

        <motion.div {...fadeInUp} className="space-y-8">
          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">1. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                By accessing or using Vivoor ("the Service"), you agree to be bound by these Terms of Service ("Terms"). 
                If you do not agree to these Terms, you may not access or use the Service.
              </p>
              <p>
                Vivoor is a decentralized live streaming platform that operates on the Kaspa blockchain and Livepeer network. 
                By using our Service, you acknowledge that you understand the nature of blockchain technology and cryptocurrency transactions.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-cyan/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">2. User Eligibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>You must be at least 13 years old to use Vivoor. If you are under 18, you must have parental consent.</p>
              <p>You represent and warrant that:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You have the legal capacity to enter into these Terms</li>
                <li>You will comply with all applicable laws and regulations</li>
                <li>You will not use the Service for any illegal or unauthorized purpose</li>
                <li>You have the right to use any content you upload to the platform</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-brand-pink/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">3. Wallet Connection & Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                To use Vivoor, you must connect a Kaspa wallet. You are solely responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintaining the security of your wallet and private keys</li>
                <li>All transactions made from your wallet</li>
                <li>Any fees associated with blockchain transactions</li>
                <li>Backing up your wallet credentials</li>
              </ul>
              <p className="font-semibold">
                Vivoor does not have access to your private keys and cannot recover lost wallets or reverse transactions.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">4. Content Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>When using Vivoor, you agree NOT to create, upload, or share content that:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Contains nudity, sexual content, or pornographic material</li>
                <li>Promotes violence, hatred, or discrimination</li>
                <li>Infringes on intellectual property rights</li>
                <li>Contains spam, malware, or phishing attempts</li>
                <li>Violates any applicable laws or regulations</li>
                <li>Harasses, threatens, or bullies other users</li>
                <li>Impersonates another person or entity</li>
                <li>Contains false or misleading information</li>
              </ul>
              <p className="font-semibold">
                Vivoor reserves the right to remove any content and suspend or terminate accounts that violate these guidelines.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-cyan/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">5. Treasury Fees & Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                Vivoor charges a treasury fee (currently 1.2 KAS) per stream to maintain platform infrastructure. 
                This fee is non-refundable once paid.
              </p>
              <p>For cryptocurrency tips and transactions:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All transactions are processed on the Kaspa blockchain</li>
                <li>Vivoor does not take a cut from tips between users</li>
                <li>All cryptocurrency transactions are final and irreversible</li>
                <li>You are responsible for any blockchain transaction fees</li>
                <li>Vivoor is not responsible for incorrect wallet addresses</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-brand-pink/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">6. Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                You retain ownership of content you create on Vivoor. By uploading content, you grant Vivoor a 
                non-exclusive, worldwide, royalty-free license to host, store, distribute, and display your content 
                as necessary to operate the Service.
              </p>
              <p>
                The Vivoor platform, including its code, design, and branding, is protected by copyright and other 
                intellectual property laws.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">7. Disclaimer of Warranties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p className="font-semibold uppercase">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.
              </p>
              <p>Vivoor disclaims all warranties, including but not limited to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Merchantability and fitness for a particular purpose</li>
                <li>Uninterrupted or error-free service</li>
                <li>Security of data or transactions</li>
                <li>Accuracy or reliability of content</li>
                <li>Value or stability of cryptocurrency</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-brand-cyan/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">8. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p className="font-semibold uppercase">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, VIVOOR SHALL NOT BE LIABLE FOR ANY DAMAGES.
              </p>
              <p>This includes but is not limited to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Loss of cryptocurrency or digital assets</li>
                <li>Loss of data or content</li>
                <li>Lost profits or business opportunities</li>
                <li>Service interruptions or technical failures</li>
                <li>Actions or content of other users</li>
                <li>Blockchain or network failures</li>
                <li>Hacking, theft, or unauthorized access</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-brand-pink/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">9. Indemnification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                You agree to indemnify, defend, and hold harmless Vivoor and its affiliates from any claims, 
                damages, losses, or expenses arising from:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your use of the Service</li>
                <li>Your content or conduct</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any rights of another party</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">10. Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                Vivoor reserves the right to suspend or terminate your access to the Service at any time, 
                with or without cause, and with or without notice.
              </p>
              <p>You may stop using the Service at any time by disconnecting your wallet.</p>
            </CardContent>
          </Card>

          <Card className="border-brand-cyan/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">11. Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                These Terms shall be governed by and construed in accordance with applicable international laws. 
                Any disputes shall be resolved through binding arbitration.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-pink/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">12. Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                Vivoor may modify these Terms at any time. Continued use of the Service after changes 
                constitutes acceptance of the new Terms. We will notify users of significant changes.
              </p>
            </CardContent>
          </Card>

          <Card className="border-brand-iris/20 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl">13. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>For questions about these Terms, please contact us through the Vivoor platform.</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Terms;
