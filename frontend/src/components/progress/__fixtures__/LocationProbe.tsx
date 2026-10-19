/** Reports the MemoryRouter's search and last navigation action, for the page tests' URL assertions. */
import { useLocation, useNavigationType } from 'react-router-dom';

export function LocationProbe() {
  const { search } = useLocation();
  const action = useNavigationType();
  return <output data-testid="location" data-action={action}>{search}</output>;
}
