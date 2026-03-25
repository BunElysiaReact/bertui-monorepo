link-all-packages.sh#!/bin/bash

# Navigate to the packages directory
cd "$(dirname "$0")/packages" || exit 1

# Loop through each directory in packages
for package in */; do
    # Remove trailing slash
    package_name="${package%/}"
    
    echo "----------------------------------------"
    echo "Linking package: $package_name"
    echo "----------------------------------------"
    
    # Navigate into package directory
    cd "$package_name" || continue
    
    # Run bun link
    bun link
    
    # Navigate back to packages directory
    cd ..
    
    echo ""
done

echo "All packages linked successfully!"