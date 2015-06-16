var pattern = "/app/";
console.log('blanket pattern',pattern);
require('blanket')({
  // Only files that match the pattern will be instrumented

  pattern: pattern
});