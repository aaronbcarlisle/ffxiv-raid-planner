import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageContainer } from './PageContainer';

describe('PageContainer tiers', () => {
  it('applies the data tier width', () => {
    const { container } = render(<PageContainer variant="data">x</PageContainer>);
    expect(container.querySelector('.max-w-data')).toBeTruthy();
  });
  it('applies the new standard tier width', () => {
    const { container } = render(<PageContainer variant="standard">x</PageContainer>);
    expect(container.querySelector('.max-w-standard')).toBeTruthy();
  });
  it('applies the focus tier width', () => {
    const { container } = render(<PageContainer variant="focus">x</PageContainer>);
    expect(container.querySelector('.max-w-focus')).toBeTruthy();
  });
  it('applies the doc tier width', () => {
    const { container } = render(<PageContainer variant="doc">x</PageContainer>);
    expect(container.querySelector('.max-w-doc')).toBeTruthy();
  });
  it('maps the deprecated "wide" alias to standard', () => {
    const { container } = render(<PageContainer variant={'wide' as never}>x</PageContainer>);
    expect(container.querySelector('.max-w-standard')).toBeTruthy();
  });
  it('maps the deprecated "narrow" alias to focus', () => {
    const { container } = render(<PageContainer variant={'narrow' as never}>x</PageContainer>);
    expect(container.querySelector('.max-w-focus')).toBeTruthy();
  });
  it('maps the deprecated "compact" alias to doc', () => {
    const { container } = render(<PageContainer variant={'compact' as never}>x</PageContainer>);
    expect(container.querySelector('.max-w-doc')).toBeTruthy();
  });
  it('defaults to standard when no variant is given', () => {
    const { container } = render(<PageContainer>x</PageContainer>);
    expect(container.querySelector('.max-w-standard')).toBeTruthy();
  });
});
