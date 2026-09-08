# Records assets/verify.gif — the real verification run, not a mockup.
#
#   vhs scripts/verify.tape
#
# NOTE: `Set TypingSpeed 35` means 35 SECONDS, not 35ms. Always use the unit.
Output assets/verify.gif

Require npm

Set Shell zsh
Set FontSize 14
Set Width 1180
Set Height 560
Set Padding 22
Set Framerate 12
Set Theme "Catppuccin Latte"

Hide
Type "cd /Users/jerel-cpk/Projects/agents-everywhere-starter-kit" Enter
Type "clear" Enter
Show

Sleep 600ms
Type@35ms "npm run verify"
Sleep 400ms
Enter
Sleep 11s
