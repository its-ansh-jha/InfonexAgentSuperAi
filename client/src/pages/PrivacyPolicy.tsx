import React from 'react';
import { Link } from 'wouter';
import { PolicyHeader } from '@/components/PolicyHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-900 text-white">
      <PolicyHeader />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 text-sm flex items-center text-white hover:text-white/80"
          asChild
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chat
          </Link>
        </Button>
        
        <div className="bg-neutral-800 rounded-xl p-6 mb-6">
          <h1 className="text-2xl font-bold mb-6 text-center">Privacy Policy</h1>
          <div className="space-y-4">
            <p><strong>Last Updated:</strong> May 12, 2025</p>
            
            <p>Welcome to InfoAgentAI. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>

            <h2 className="text-xl font-semibold mt-6">1. Information We Collect</h2>
            <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
              <li><strong>Contact Data</strong> includes email address and telephone numbers.</li>
              <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this website.</li>
              <li><strong>Usage Data</strong> includes information about how you use our website, products, and services.</li>
              <li><strong>Conversation Data</strong> includes the content of conversations you have with our AI systems, including regular chat, search queries, and reasoning requests.</li>
            </ul>

            <h2 className="text-xl font-semibold">2. AI Models and Services</h2>
            <p>InfoAgentAI uses multiple AI models to provide different types of responses:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>GPT-4o</strong>: Primary conversational AI with vision capabilities for text and image analysis</li>
              <li><strong>GPT-4o-mini</strong>: Used for real-time search result refinement and processing</li>
              <li><strong>o4 mini reasoning model</strong>: Advanced reasoning model for complex problem-solving and step-by-step analysis</li>
              <li><strong>DeepSeek R1</strong>: Alternative reasoning model for enhanced logical thinking</li>
            </ul>

            <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
            <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>To register you as a new customer.</li>
              <li>To provide and improve our services.</li>
              <li>To manage our relationship with you.</li>
              <li>To make suggestions and recommendations to you about goods or services that may be of interest to you.</li>
              <li>To improve our AI models based on your interactions.</li>
            </ul>

            <h2 className="text-xl font-semibold">4. Data Security</h2>
            <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way, altered, or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors, and other third parties who have a business need to know.</p>

            <h2 className="text-xl font-semibold">5. Data Retention</h2>
            <p>We will only retain your personal data for as long as necessary to fulfill the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements.</p>

            <h2 className="text-xl font-semibold">6. Your Legal Rights</h2>
            <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Request access to your personal data</li>
              <li>Request correction of your personal data</li>
              <li>Request erasure of your personal data</li>
              <li>Object to processing of your personal data</li>
              <li>Request restriction of processing your personal data</li>
              <li>Request transfer of your personal data</li>
              <li>Right to withdraw consent</li>
            </ul>

            <h2 className="text-xl font-semibold">7. Changes to This Privacy Policy</h2>
            <p>We may update our privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last Updated" date at the top of this privacy policy.</p>

            <h2 className="text-xl font-semibold">8. Contact Us</h2>
            <p>If you have any questions about this privacy policy or our privacy practices, please contact us at:</p>
            <p>Email: privacy@infoagentai.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}