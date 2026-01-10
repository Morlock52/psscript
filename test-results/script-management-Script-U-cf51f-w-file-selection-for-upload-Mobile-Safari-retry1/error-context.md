# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications Alt+T"
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "PSScript" [level=1] [ref=e6]
      - paragraph [ref=e7]: PowerShell Script Management
    - generic [ref=e8]:
      - heading "Login" [level=2] [ref=e9]
      - generic [ref=e11]:
        - img [ref=e13]
        - 'heading "Server error: 429" [level=3] [ref=e16]'
      - generic [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: Email Address
          - textbox "Email Address" [ref=e20]:
            - /placeholder: you@example.com
        - generic [ref=e21]:
          - generic [ref=e22]:
            - generic [ref=e23]: Password
            - link "Forgot password?" [ref=e24]:
              - /url: "#"
          - textbox "Password" [ref=e25]:
            - /placeholder: ••••••••
        - generic [ref=e26]:
          - checkbox "Remember me" [ref=e27]
          - generic [ref=e28]: Remember me
        - button "Sign in" [ref=e29] [cursor=pointer]
      - paragraph [ref=e31]:
        - text: Don't have an account?
        - link "Sign up" [ref=e32]:
          - /url: /register
      - generic [ref=e33]:
        - heading "Demo Information" [level=3] [ref=e34]
        - paragraph [ref=e35]: This is a demo application with a mocked authentication system. You can use any email and password to log in.
        - button "Use Default Login" [ref=e36] [cursor=pointer]
    - generic [ref=e37]: © 2026 PSScript. All rights reserved.
```