'use client';

import { Button, Heading, Text, Box } from '@vibe/core';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <Box className="flex flex-col items-center justify-center min-h-screen">
      <Box className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <Heading type={Heading.types.H1}>
            FP&A Command Platform
          </Heading>
          <Text type={Text.types.TEXT1} className="mt-2">
            Sign in with your Monday.com account
          </Text>
        </div>

        <Button
          onClick={() => window.location.href = '/api/auth/monday'}
          size={Button.sizes.LARGE}
          kind={Button.kinds.PRIMARY}
          className="w-full"
        >
          <Image
            src="/monday-logo.png"
            alt="Monday"
            width={20}
            height={20}
            className="mr-2"
          />
          Continue with Monday.com
        </Button>

        <Text size={Text.sizes.SMALL} className="text-center text-gray-500">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </Box>
    </Box>
  );
}
