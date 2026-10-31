# Prompt Examples

The purpose of this document is to provide a list of some of the prompts I used while developing the demo app so as to provide reviewers with an idea of the kinds of prompts I write when doing Agentic development.

## Design review

### 1. Requesting the architecture review

> Take the role of a Software Architect and review system-design-baseline-doc.txt. Provide constructive criticism and suggest improvements in line with industry best practices when and where necessary. Do not be overly obsequious. When suggesting changes, include your reasoning. Output the result of your analysis into a Markdown file named system-design-proposal-analysis.md and place it in the author-dev-docs directory.

### 2. Starting the guided walkthrough

> We will now generate a new system-design-final-draft.md document by walking through your system-design-proposal-analysis.md document and addressing the issues and findings one by one. Once again, act as a Software Architect and guide me through resolving each issue and finding.

## Design walkthrough decisions

The prompts below were written during that walkthrough. Claude presented each finding with options and a recommendation; these are some of my responses. A short note gives the context for each.

### 3. How the simulated bidder would behave

**Context:** Claude recommended a Server-Sent Events stream plus a simulated competing bidder for live bid updates. Before choosing, I asked how it would actually behave.

> Regarding the SSE stream per vehicle and simulated competing bidder: How would those work? Is it automatic when a bid is placed by the user or is there a button or other trigger that needs to be hit in order for the "simulated competing bidder" to act?

### 4. Keeping a sign-in button

**Context:** Claude recommended dropping the login screen in favor of a session created automatically on page load. I asked how that would work and stated my preference. The final design keeps browsing open to everyone, with a "Sign in" button in the header.

> Regarding the implicit session: how will the "first request" happen? Will there be a login button? I would prefer that.

### 5. Bid increments

**Context:** choosing how bid increments work. Option 1 was increments that scale with the price ($100 / $250 / $500).

> Option 1, but make sure to include rationale in decision log. Since this is a demo app, the numbers are kept simple for explanatory purposes.

### 6. Overriding the recommendation on Buy Now

**Context:** deciding what to do with the Buy Now prices in the dataset. Claude recommended hiding them and listing Buy Now as a non-goal; option 3 was a full Buy Now action that ends the auction at once. I overrode the recommendation.

> Option 3, but include the rationale in the Decision Log. This will be included in order to more fully replicate a real auction app's workflow.

### 7. Blocking self-raises

**Context:** without proxy bidding, a buyer who already holds the high bid can only raise the price against themselves. Option 1 was to block that bid and disable bidding until someone outbids them.

> Option 1, but include rationale in Decision Log. Many major auction apps, such as eBay and Auctionet, strictly prevent you from outbidding yourself.

### 8. A bid confirmed against a stale price

**Context:** deciding what happens when another bid arrives while the buyer is still confirming theirs. Option 1 was to reject the bid and show the buyer the new price.

> Option 1, add reasoning in Decision log. This provides a smoother user experience, as users will not submit bids that they think will become the highest bid, but will not actually do so due to another user submitting a higher bid, which might confuse some users.

### 9. The search bar on phones

**Context:** deciding how the pinned search bar behaves on phones. Option 1 was a compact search bar that is always visible, with filters in a drawer.

> Option 1, but make sure to log the reasoning in Decision Log. Search bar itself is always visible, but the filters open in a drawer on Mobile in order to conserve space and prevent visual clutter. This is common on mobile devices.

### 10. Building in tiers with review gates

**Context:** the finished design was larger than the challenge's 3-4 hour time box, so it was split into priority tiers (P0, P1, P2). Option 1 was to build the tiers in order and report the time spent openly. I added review gates. Each tier is then started with a short go-ahead, such as "Start P0".

> Option 1, make sure to build each tier and then stop, allowing me to run the app and see how the app is progressing. I will manually tell you when you can continue with the next tier. Project should be runnable and buildable at each tier completion.

## During the build

The prompts below were written during the build, at the review gate after each tier. I ran the app myself and tested it against a checklist Claude gave me ("Give me the list of things done in P0 again so I can check it all when I run the project").

### 11. Bug report after testing P0 by hand

**Context:** bugs I found while testing the P0 bid flow by hand. Each one states what I did, what happened, and what I expected. Claude traced the missing dialog to its root cause: the custom-amount form was never bound to its Angular form group, so clicking Place bid never reached the bid logic. It fixed all three and added a unit test for each.

> Regarding the custom amount field for bidding: The field does outline in red and show error messages for invalid amounts, but the Place Bid button can still be hit under those circumstances. I don't think that's good UI/UX.
>
> Regarding Signed Out status: If a user is Signed Out, the Place Bid button under the custom bid amount field should open sign-in just like the default Bid button.
>
> Regarding confirmation dialog: The dialog does not appear if you hit Place Bid.
>
> Other than that, everything is okay.

### 12. Restructuring the client directories

**Context:** reviewing the P0 code layout. The client kept pages and the components they use together under one features directory. I set out the structure I wanted and which parts to leave alone.

> Another thing: I want you to restructure the directories. Right now, the features directory seems to contain pages AND components. I want a separate pages and components directory. Pages should contain subdirectories named after each view (i.e. the auction page, the vehicle page, the user profile page, the bids page, and so on). The components directory should contain components like the bid panel, etc in named subdirectories. Each subdirectory should contain the model (.ts file), the styles page (.scss), the template (.html), and the unit test file.
>
> I also want a services directory that contains the various services. The core directory and its subdirectories are fine as they are.
