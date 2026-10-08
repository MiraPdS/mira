import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addMemberSchema, type AddMemberInput } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useAddMember } from './useProjects';

interface InviteMemberFormProps {
  projectId: string;
}

export function InviteMemberForm({ projectId }: InviteMemberFormProps) {
  const addMember = useAddMember(projectId);
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: '',
      role: 'MEMBER',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSuccessMessage('');

    try {
      await addMember.mutateAsync(values);
      setSuccessMessage('Miembro agregado correctamente.');
      reset();
    } catch {
      // TanStack Query guarda el error en addMember.error.
    }
  });

  const errorServidor =
    addMember.error instanceof ApiRequestError
      ? addMember.error.message
      : addMember.isError
        ? 'No se pudo invitar al miembro.'
        : undefined;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Invitar miembro</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ingresa el correo de un usuario registrado para agregarlo al proyecto.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="member-email" label="Correo electronico" error={errors.email?.message}>
          <Input
            id="member-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'member-email-error' : undefined}
            {...register('email')}
          />
        </Field>

        {errorServidor && !successMessage ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorServidor}
          </p>
        ) : null}

        {successMessage ? (
          <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting || addMember.isPending}>
          {addMember.isPending ? 'Invitando...' : 'Invitar miembro'}
        </Button>
      </form>
    </section>
  );
}
