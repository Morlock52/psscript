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
      - generic [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: Email Address
          - textbox "Email Address" [ref=e13]:
            - /placeholder: you@example.com
        - generic [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]: Password
            - link "Forgot password?" [ref=e17] [cursor=pointer]:
              - /url: "#"
          - textbox "Password" [ref=e18]:
            - /placeholder: ••••••••
        - generic [ref=e19]:
          - checkbox "Remember me" [ref=e20]
          - generic [ref=e21]: Remember me
        - button "Sign in" [ref=e22] [cursor=pointer]
      - paragraph [ref=e24]:
        - text: Don't have an account?
        - link "Sign up" [ref=e25] [cursor=pointer]:
          - /url: /register
      - generic [ref=e26]:
        - heading "Demo Information" [level=3] [ref=e27]
        - paragraph [ref=e28]: This is a demo application with a mocked authentication system. You can use any email and password to log in.
        - button "Use Default Login" [ref=e29] [cursor=pointer]
    - generic [ref=e30]: © 2026 PSScript. All rights reserved.
```