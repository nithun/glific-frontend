import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { BrowserRouter as Router } from 'react-router';

import {
  filterByTagInteractiveQuery,
  filterInteractiveQuery,
  getFilterInteractiveCountQuery,
  getInteractiveCountQuery,
} from 'mocks/InteractiveMessage';
import { setUserSession } from 'services/AuthService';
import InteractiveMessageList from './InteractiveMessageList';
import { getFilterTagQuery } from 'mocks/Tag';
import { FILTER_INTERACTIVE_MESSAGES, GET_INTERACTIVE_MESSAGES_COUNT } from 'graphql/queries/InteractiveMessage';

const mocks = [
  filterInteractiveQuery,
  filterInteractiveQuery,
  getInteractiveCountQuery,
  getFilterTagQuery,
  filterByTagInteractiveQuery,
  getFilterInteractiveCountQuery,
];
setUserSession(JSON.stringify({ roles: ['Admin'] }));

beforeEach(() => {
  cleanup();
});

const list = (
  <MockedProvider mocks={mocks} addTypename={false}>
    <Router>
      <InteractiveMessageList />
    </Router>
  </MockedProvider>
);

const mockedUsedNavigate = vi.fn();
vi.mock('react-router', async () => ({
  ...(await vi.importActual('react-router')),
  useNavigate: () => mockedUsedNavigate,
}));

test('Interactive message list renders correctly', async () => {
  render(list);
  expect(screen.getByTestId('loading')).toBeInTheDocument();

  await waitFor(() => {
    const title = screen.getByText('Interactive messages');
    const label = screen.getByText('Title');
    const messageBody = screen.getByText('Message');
    const type = screen.getByText('Type');

    expect(title).toBeInTheDocument();
    expect(label).toBeInTheDocument();
    expect(messageBody).toBeInTheDocument();
    expect(type).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText('Are you excited for Glific?')).toBeInTheDocument();
    expect(screen.getAllByText('Quick Reply')[0]).toBeInTheDocument();
  });
});

test('should navigate to create template page', async () => {
  render(list);

  await waitFor(() => {
    expect(screen.getByText('Interactive messages')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('newItemButton'));

  expect(mockedUsedNavigate).toHaveBeenCalledWith('/interactive-message/add');
});

test('Translation is shown', async () => {
  render(list);
  expect(screen.getByTestId('loading')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Interactive messages')).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByTestId('down-arrow')[0]);

  await waitFor(() => {
    expect(screen.getByText('ग्लिफ़िक सभी नई सुविधाओं के साथ आता है')).toBeInTheDocument();
  });
});

test('It navigates to edit on clicking copy ', async () => {
  render(list);
  expect(screen.getByTestId('loading')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Interactive messages')).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByTestId('copy-interactive-message')[0]);

  await waitFor(() => {
    expect(mockedUsedNavigate).toHaveBeenCalled();
  });
});

test('It changes tag filter value', async () => {
  render(list);
  expect(screen.getByTestId('loading')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Interactive messages')).toBeInTheDocument();
  });

  const autoComplete = screen.getAllByRole('combobox')[0];

  autoComplete.focus();
  fireEvent.keyDown(autoComplete, { key: 'ArrowDown' });
  fireEvent.keyDown(autoComplete, { key: 'ArrowDown' });
  fireEvent.keyDown(autoComplete, { key: 'Enter' });

  await waitFor(() => {
    expect(autoComplete).toHaveValue('Messages');
  });

  fireEvent.click(screen.getByTestId('newItemButton'));
  expect(mockedUsedNavigate).toHaveBeenCalledWith('/interactive-message/add', {
    state: { tag: { label: 'Messages', id: '1' } },
  });
});

// T18: the `typeMappings[text] || text` fallback in InteractiveMessageList's getType()
// (PRD-005 T16) must render the raw type string for a type it doesn't know about, rather
// than silently rendering blank — this is what a future SwiftChat-only type would hit.
const unknownTypeFilterRequest = {
  request: {
    query: FILTER_INTERACTIVE_MESSAGES,
    variables: {
      filter: {},
      opts: { limit: 50, offset: 0, order: 'ASC', orderWith: 'label' },
    },
  },
  result: {
    data: {
      interactiveTemplates: [
        {
          id: '99',
          label: 'unrecognized type template',
          type: 'SWIFTCHAT_FUTURE_TYPE',
          translations: '{}',
          language: { id: '1', label: 'English' },
          sendWithTitle: true,
          interactiveContent: '{"type":"list","body":"pick one"}',
        },
      ],
    },
  },
};

const unknownTypeCountRequest = {
  request: {
    query: GET_INTERACTIVE_MESSAGES_COUNT,
    variables: { filter: {} },
  },
  result: { data: { countInteractiveTemplates: 1 } },
};

test('type column falls back to the raw type string for an unrecognized type', async () => {
  render(
    <MockedProvider
      mocks={[unknownTypeFilterRequest, unknownTypeFilterRequest, unknownTypeCountRequest, getFilterTagQuery]}
      addTypename={false}
    >
      <Router>
        <InteractiveMessageList />
      </Router>
    </MockedProvider>
  );

  await waitFor(() => {
    expect(screen.getByText('SWIFTCHAT_FUTURE_TYPE')).toBeInTheDocument();
  });
});
