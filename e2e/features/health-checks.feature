Feature: Website Health Checks
  Scenario: Home page loads successfully
    Given I navigate to "/"
    Then page loads with status code 200
    And AmbientOverlay component is visible
    And main navigation links are present

  Scenario: All pages are accessible
    Given I navigate to each page:
      | /about |
      | /locations |
      | /contact |
    Then all pages load successfully
    And no console errors appear

  Scenario: Navigation menu works on mobile
    Given viewport is set to 375x667 (iPhone SE)
    When I navigate to "/"
    And I click the hamburger menu
    Then navigation drawer opens
    And I can click navigation links

  Scenario: Contact form validation works
    Given I navigate to "/contact"
    When I attempt to submit empty form
    Then validation errors are shown
    When I fill form with invalid email
    And I submit form
    Then email error appears

  Scenario: Contact form submits successfully
    Given I navigate to "/contact"
    When I fill contact form with valid data
    And I submit form
    Then success message is displayed
    And form is reset

Feature: SEO Compliance
  Scenario: Meta tags are present on all pages
    Given I navigate to each page:
      | / |
      | /about |
      | /locations |
      | /contact |
    Then each page has meta description
    And each page has Open Graph tags
    And canonical URLs are set

  Scenario: Schema.org markup is valid
    Given I navigate to "/"
    Then JSON-LD schema is valid
    And organization schema includes required fields

Feature: Performance and Core Web Vitals
  Scenario: Page loads quickly
    Given I navigate to "/"
    Then page load time is under 3 seconds
    And Largest Contentful Paint is under 2.5 seconds

  Scenario: No layout shifts on initial load
    Given I navigate to "/"
    Then Cumulative Layout Shift is under 0.1

Feature: Responsive Design
  Scenario: Mobile layout renders correctly
    Given viewport is set to 375x667
    When I navigate to "/"
    Then touch targets are at least 48x48px
    And text is readable without horizontal scroll
    And images scale properly

  Scenario: Tablet layout renders correctly
    Given viewport is set to 768x1024
    When I navigate to "/"
    Then content is properly spaced
    And grid layouts display correctly

  Scenario: Desktop layout renders correctly
    Given viewport is set to 1024x768
    When I navigate to "/"
    Then navigation shows horizontally
    And footer displays in proper grid
