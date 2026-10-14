"""Qualification budgets, without loading Hermes or contacting a provider."""
import os
import unittest
from unittest.mock import patch

from qualify_behavior import qualification_iterations


class QualificationBudgetTests(unittest.TestCase):
    def budget(self, profile_limit, requested=None):
        environment = {} if requested is None else {'HERMES_MARKETING_TEST_ITERATIONS': requested}
        with patch.dict(os.environ, environment, clear=True):
            return qualification_iterations(profile_limit)

    def test_default_stays_within_a_lower_profile_budget(self):
        for limit, expected in [(8, 4), (3, 3), (1, 1), (16, 4)]:
            with self.subTest(limit=limit):
                self.assertEqual(self.budget(limit), expected)

    def test_explicit_budget_accepts_both_boundaries(self):
        for limit, requested, expected in [(8, '1', 1), (8, '8', 8), (3, '3', 3)]:
            with self.subTest(limit=limit, requested=requested):
                self.assertEqual(self.budget(limit, requested), expected)

    def test_campaign_cannot_raise_the_budget_to_sixteen(self):
        for limit, requested in [(8, '9'), (8, '16'), (16, '16'), (3, '4')]:
            with self.subTest(limit=limit, requested=requested):
                with self.assertRaises(ValueError):
                    self.budget(limit, requested)

    def test_invalid_requested_budgets_are_rejected(self):
        for requested in ['0', '-1', '', '1.5', 'eight']:
            with self.subTest(requested=requested):
                with self.assertRaises(ValueError):
                    self.budget(8, requested)

    def test_invalid_profile_budgets_are_not_coerced(self):
        for limit in [None, True, False, '8', 1.5, 0, -1]:
            with self.subTest(limit=limit):
                with self.assertRaises(ValueError):
                    self.budget(limit)


if __name__ == '__main__':
    unittest.main()
