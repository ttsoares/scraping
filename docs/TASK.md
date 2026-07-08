# Mission

Read the repository documentation before making any changes. Treat the repository as the authoritative source of truth.

Your mission is to implement the first working version of the Engineering Verification UI using Next.js (latest stable release).

This is not a production frontend.

The objective is to provide a simple web interface that allows developers to manually execute providers and inspect their behavior.

## Requirements

Create a Next.js application inside the repository.

The application must be easy to run with:

npm install
npm run dev

Do not introduce unnecessary frameworks or complex state-management libraries.

Keep the implementation simple.

## Functional requirements

Implement a first working version containing:

search text box
provider selector
initially support:
Pichau
KaBuM
Search button
results table

Each result must display at least:

image
title
price
store/provider
product URL

Below or above the results also display:

execution time
number of products found
provider used
current page

Display any provider errors without crashing the UI.

## Architecture

The UI must consume the existing provider abstraction.

Do not duplicate scraping logic.

Do not move provider code into the frontend.

Keep scraping inside the existing provider layer.

Design the UI so new providers can be added with minimal changes.

## Scope

This loop is only about creating the initial engineering interface.

Do NOT implement:

authentication
persistence
production styling
responsive design
dark mode
deployment
user accounts
caching
comparison between providers
parallel execution
pagination improvements

Only implement what is necessary to obtain a working engineering tool.

## Documentation

Update repository documentation describing:

architecture
directory structure
how to run the UI
any dependencies introduced
Verification

## Verify that:

the project builds successfully
the Next.js application starts
searches execute correctly using existing providers
results are displayed correctly
provider errors are handled gracefully

Stop after verification.

Do not start another task autonomously.
