// Featured reviews — REAL, verbatim (lightly trimmed with ellipses) from the
// company's Google profile. Names shown as first name + last initial. Do not
// fabricate quotes, names, locations, or services.

export type Review = {
  quote: string;
  author: string;
  detail: string; // honest attribution (service where stated + "Google review")
};

export const reviews: Review[] = [
  {
    quote:
      "They were courteous, took time to explain what they were doing and gave me status updates. Happy with the quality. It's good to see that there are still contractors out there that do a good job and are good folks.",
    author: "Abi E.",
    detail: "Verified Google review",
  },
  {
    quote:
      "They were able to make it out the same day I called, diagnosed the issue and made the repair… the price was extremely reasonable. I would definitely recommend them to anyone.",
    author: "Jon S.",
    detail: "Same-day service · Google review",
  },
  {
    quote:
      "He did the best he could to be as fast as possible while still giving the best service and doing the job right. I would definitely recommend to friends and family!",
    author: "Leanne G.",
    detail: "Verified Google review",
  },
];
