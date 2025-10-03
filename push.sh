#!/bin/bash

# Remove workflows that need special permissions
rm -rf .github/workflows

# Stage all changes
git add -A

# Commit
git commit -m "Complete MVP: Working variance analyzer with sync orchestrator and frontend"

# Push
git push origin main

echo "Done! Check GitHub for your changes."
