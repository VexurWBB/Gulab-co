import { handleEnquiry } from '../server/enquiry.js';

// Vercel's Node runtime supports the Web Request/Response signature.
export default {
  fetch(request) {
    return handleEnquiry(request, process.env);
  },
};
